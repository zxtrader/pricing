import {
	CancellationToken, Initable as InitableLike,
	Financial, Logger, SubscriberChannel
} from "@zxteam/contract";
import { ManualCancellationTokenSource } from "@zxteam/cancellation";
import { Initable, Disposable } from "@zxteam/disposable";
import { wrapErrorIfNeeded, ArgumentError, AggregateError } from "@zxteam/errors";
import loggerFactory from "@zxteam/logger";

import * as moment from "moment";
import * as path from "path";
import * as _ from "lodash";
import { EventEmitter } from "events";
import { setInterval, clearInterval } from "timers";

import { PriceLoader } from "../input/PriceLoader";
import { Storage } from "../storage/Storage";
import { CryptoCompareApiClient } from "../clients/CryptoCompareApiClient";
import { PriceApi } from "./PriceApi";
import { SubscriberChannelMixin } from "@zxteam/channels";
import { financial } from "../financial";
import { RealtimePriceStream } from "../input/RealtimePriceStream";
import { CoinGetRecorderRedisSubscriber } from "../input/RealtimePriceStreamImpl/CoinGetRecorderRedisSubscriber";

const { name: serviceName, version } = require(path.join(__dirname, "..", "..", "package.json"));

export class PriceApiImpl extends Initable implements PriceApi {
	private readonly _log: Logger;
	private readonly _aggregatedPriceSourceName: string;
	private readonly _disposingCancellationTokenSource: ManualCancellationTokenSource;
	private readonly _notificationEmitter: EventEmitter;
	private readonly _currentPriceManager: RealtimePriceManager;
	private readonly _changeRateWatchers: Map<string/*market key*/, {
		destroy(): void;
		addChanel(channel: PriceApi.ChangeRateNotification.Channel): void;
		removeChanel(channel: PriceApi.ChangeRateNotification.Channel): void;
	}>;
	private readonly _cryptoCompareApiClient: CryptoCompareApiClient;
	private readonly _realtimePriceStreams: Set<RealtimePriceStream>;
	private readonly _storageFactory: () => Storage;
	private readonly _sourceProviders: Array<PriceLoader>;
	private readonly _sourcesId: Array<string>;
	private readonly _intrestedPairs: Array<string>;
	private __logStatusData: { coingetMessages: number; cryptocompareCalls: number; activeSubscriptions: number; };
	private __logStatusInterval: NodeJS.Timeout | null;
	private __syncInterval: NodeJS.Timeout | null;
	private __syncIntervalExecutionFlag: boolean;
	private __storage: Storage | null;

	public constructor(opts: PriceApiImpl.Opts) {
		super();
		this._log = opts.log || loggerFactory.getLogger("PriceApi");
		this._aggregatedPriceSourceName = opts.aggregatedPriceSourceName !== undefined ? opts.aggregatedPriceSourceName : "ZXTRADER";
		this._disposingCancellationTokenSource = new ManualCancellationTokenSource();
		this._notificationEmitter = new EventEmitter();
		this._currentPriceManager = new RealtimePriceManager();
		this._changeRateWatchers = new Map();
		this._realtimePriceStreams = new Set();
		this._storageFactory = opts.storageFactory;
		this._sourceProviders = opts.sourceProviders;
		this._sourcesId = this._sourceProviders.map((source) => source.sourceId);
		this._cryptoCompareApiClient = new CryptoCompareApiClient(serviceName, this._log);
		this._realtimePriceStreams.add(new CoinGetRecorderRedisSubscriber(opts.coingetRecorderStreamRedisURL));
		this._intrestedPairs = [];
		this.__logStatusInterval = null;
		this.__syncInterval = null;
		this.__syncIntervalExecutionFlag = false;
		this.__storage = null;
		this.__logStatusData = { coingetMessages: 0, cryptocompareCalls: 0, activeSubscriptions: 0 };

		for (const realtimePriceStream of this._realtimePriceStreams) {
			realtimePriceStream.addHandler(this._onRealtimePriceStream.bind(this));
		}
	}

	/**
	 * Get historical prices for few sources provider
	 * @param cancellationToken Cancellation Token allows your to cancel execution process
	 * @param args criteria for price search
	 */
	public async getHistoricalPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>)
		: Promise<PriceApi.Timestamp> {
		this.verifyInitializedAndNotDisposed();

		if (this._log.isTraceEnabled) {
			this._log.trace("getHistoricalPrices()... args: ", args);
		}
		if (args.length === 0) {
			throw new ArgumentError("args", "Wrong arguments");
		}

		this._log.trace("Validate date");
		validateDate(args);

		this._log.trace("Check prices in storage provide");
		const filterEmptyPrices: Array<PriceApi.LoadDataRequest> =
			await this._storage.filterEmptyPrices(cancellationToken, args, this._sourcesId);

		this._log.trace("Check cancellationToken for interrupt");
		cancellationToken.throwIfCancellationRequested();

		if (this._log.isTraceEnabled) {
			this._log.trace(`Checking exsist price which need load from sources ${filterEmptyPrices.length}`);
		}

		if (filterEmptyPrices.length > 0) {

			this._log.trace("Loading prices from sources through function manager");
			const newPrices: Array<PriceApi.HistoricalPrices> =
				await this.managerSourceProvider(cancellationToken, filterEmptyPrices);

			this._log.trace("Check cancellationToken for interrupt");
			cancellationToken.throwIfCancellationRequested();

			if (newPrices.length > 0) {
				this._log.trace("Save new prices to storage provide");
				await this._storage.savePrices(cancellationToken, newPrices);

				this._log.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();
			}
		}

		this._log.trace("Read prices from storage provider");
		const friendlyPrices: PriceApi.Timestamp = await this._storage.findPrices(cancellationToken, args);

		if (this._log.isTraceEnabled) {
			this._log.trace(`Return result: ${friendlyPrices}`);
		}
		return friendlyPrices;
	}

	public async ping(
		cancellationToken: CancellationToken, echo: string
	): Promise<{ readonly echo: string; readonly time: Date; readonly version: string; }> {
		return {
			echo,
			time: new Date(),
			version
		};
	}

	public async createChangePriceSubscriber(
		cancellationToken: CancellationToken, threshold: number, pairs: ReadonlyArray<string>, exchanges: ReadonlyArray<string>
	): Promise<PriceApi.ChangePriceNotification.Channel> {
		// В этом методе мы используем все каналы из CurrentPriceManager по интересующим парами/источникам
		// и заворачиваем события о об изменении цен, в ChangePriceNotification

		const handlers: Array<PriceApi.ChangePriceNotification.Callback> = [];
		const priceChannels: Array<RealtimePriceManager.PriceUpdateChannel> = [];

		const friendlyExchanges = [...new Set(exchanges).add(this._aggregatedPriceSourceName)];

		const friendlyPairs: Array<Pair> = [];

		for (const pair of pairs) {
			const splittedPair = pair.split("/");
			if (splittedPair.length !== 2) {
				throw new ArgumentError("pairs", `Wrong pair ${pair}`);
			}

			if (this._intrestedPairs.indexOf(pair) === -1) {
				this._intrestedPairs.push(pair);
			}

			const [tradeCurrency, marketCurrency] = splittedPair;
			friendlyPairs.push({ marketCurrency, tradeCurrency });

			for (const exchange of friendlyExchanges) {
				const priceChannel = this._currentPriceManager.getPriceChannel(marketCurrency, tradeCurrency, exchange);
				priceChannels.push(priceChannel);
			}
		}

		const notificationFunction = async () => {
			const notifyDate = new Date();
			try {
				const prices = this._currentPriceManager.filter(friendlyPairs, friendlyExchanges);

				// 0.25% noise
				const pricesWithNoise = emulatorPriceChangingByNoise(prices, 0.0025);

				for (const handler of handlers) {
					await handler({
						data: {
							date: notifyDate,
							prices: pricesWithNoise
						}
					});
				}
			} catch (e) {
				this._log.warn("VERY UNEXPECTED ERROR", e);
			}
		};


		let thresholdInterval: NodeJS.Timeout | null = null;
		// const priceChannelHandler = async (priceEvent: RealtimePriceManager.PriceUpdateEvent | Error) => {
		// 	if (priceEvent instanceof Error) { return; }

		// 	if (thresholdTimeout === null) {
		// 		const { data: priceData } = priceEvent;

		// 		const notificationDate: Date = new Date(); // now
		// 		const deplayFromLastUpdate: number = notificationDate.getTime() - lastNotificationDate.getTime();

		// 		thresholdTimeout = setTimeout(
		// 			notificationFunction,
		// 			deplayFromLastUpdate < threshold ? threshold - deplayFromLastUpdate : 0
		// 		);
		// 	}
		// };

		// for (const priceChannel of priceChannels) {
		// 	priceChannel.addHandler(priceChannelHandler);
		// }

		const channelAdapter: PriceApi.ChangePriceNotification.Channel = Object.freeze({
			addHandler(cb) {
				handlers.push(cb);
				if (handlers.length === 1) {
					thresholdInterval = setInterval(notificationFunction, threshold);
				}
			},
			removeHandler(cb) {
				const handlerIndex = handlers.indexOf(cb);
				if (handlerIndex !== -1) {
					handlers.splice(handlerIndex, 1);
				}
				if (handlers.length === 1) {
					if (thresholdInterval !== null) {
						clearInterval(thresholdInterval);
						thresholdInterval = null;
					}
				}
			},
			dispose: (): Promise<void> => {
				// for (const priceChannel of priceChannels) {
				// 	priceChannel.removeHandler(priceChannelHandler);
				// }
				if (thresholdInterval !== null) {
					clearInterval(thresholdInterval);
					thresholdInterval = null;
				}
				this.__logStatusData.activeSubscriptions--;
				return Promise.resolve();
			}
		});

		this.__logStatusData.activeSubscriptions++;
		return channelAdapter;
	}

	public async createChangeRateSubscriber(
		cancellationToken: CancellationToken, threshold: number, marketCurrency: string, tradeCurrency: string
	): Promise<PriceApi.ChangeRateNotification.Channel> {
		const eventKey: string = `rate:${marketCurrency}:${tradeCurrency}`; // Temporaty implementation without exchangeId

		const pair = `${tradeCurrency}/${marketCurrency}`;
		if (this._intrestedPairs.indexOf(pair) === -1) {
			this._intrestedPairs.push(pair);
		}

		let watcher = this._changeRateWatchers.get(eventKey);
		if (watcher === undefined) {
			const watchCancellationToken = new ManualCancellationTokenSource();
			const timer = setInterval(async () => {
				try {
					const price = this._currentPriceManager.getPrice(marketCurrency, tradeCurrency, this._aggregatedPriceSourceName);
					if (price !== null) {
						const now = new Date();
						// const ccPrice: Financial = await this._cryptoCompareApiClient
						// 	.getPrice(watchCancellationToken.token, marketCurrency, tradeCurrency);
						this._notificationEmitter.emit(eventKey, { date: now, price });
					}
				} catch (e) {
					if (this._log.isWarnEnabled) { this._log.warn(`Failed to get price for ${eventKey}`); }
					if (this._log.isDebugEnabled) { this._log.debug(`Failed to get price for ${eventKey}. Inner error: ${e.message}`); }
					if (this._log.isTraceEnabled) { this._log.trace(`Failed to get price for ${eventKey}.`, e); }
				}
			}, 1000);
			const channels = new Set<PriceApi.ChangeRateNotification.Channel>();
			watcher = Object.freeze({
				destroy() {
					clearInterval(timer);
					watchCancellationToken.cancel();
				},
				addChanel: (c: PriceApi.ChangeRateNotification.Channel) => {
					channels.add(c);
				},
				removeChanel: (c: PriceApi.ChangeRateNotification.Channel) => {
					channels.delete(c);
					if (channels.size === 0) {
						clearInterval(timer);
						this._changeRateWatchers.delete(eventKey);
					}
				}
			});
			this._changeRateWatchers.set(eventKey, watcher);
		}

		const handlers: Set<PriceApi.ChangeRateNotification.Callback> = new Set();

		const onChangeRate = async (data: any) => {
			for (const handler of handlers) {
				try {
					await handler({ data });
				} catch (e) {
					this._log.warn("Unexpected error in handler");
					this._log.debug("Unexpected error in handler", e.message);
					this._log.trace("Unexpected error in handler", e);
				}
			}
		};

		const channelWatcher = watcher;
		const channel: PriceApi.ChangeRateNotification.Channel = Object.freeze({
			cb: null,
			addHandler: cb => { handlers.add(cb); },
			removeHandler: cb => { handlers.delete(cb); },
			dispose: (): Promise<void> => {
				this._notificationEmitter.removeListener(eventKey, onChangeRate);
				channelWatcher.removeChanel(channel);
				this.__logStatusData.activeSubscriptions--;
				return Promise.resolve();
			}
		});

		this._notificationEmitter.on(eventKey, onChangeRate);

		watcher.addChanel(channel);

		this.__logStatusData.activeSubscriptions++;
		return channel;
	}

	protected async onInit(cancellationToken: CancellationToken) {
		this._log.debug("Initializing");
		//await this._cryptoCompareApiClient.init(cancellationToken);
		const storage: Storage = this._storageFactory();

		const inittables: Array<InitableLike> = [storage];

		for (const realtimePriceStream of this._realtimePriceStreams) {
			if ("init" in (realtimePriceStream as any)) {
				if (_.isFunction((realtimePriceStream as any).init)) {
					inittables.push((realtimePriceStream as any));
				}
			}
		}

		await Initable.initAll(cancellationToken, ...inittables);

		this.__storage = storage;
		this.__syncInterval = setInterval(this._onSyncTimer.bind(this), 300000);
		this.__logStatusInterval = setInterval(this._onStatusTimer.bind(this), 60000);
	}

	protected async onDispose() {
		await this._cryptoCompareApiClient.dispose();

		clearInterval(this.__logStatusInterval!);
		this.__logStatusInterval = null;

		clearInterval(this.__syncInterval!);
		this.__syncInterval = null;

		const storage: Storage = this.__storage!;
		this.__storage = null;
		await storage.dispose();
	}

	private get _storage(): Storage {
		if (this.__storage === null) {
			throw new Error("Wrong oparation at current state. Did you init()?");
		}
		return this.__storage;
	}

	private async managerSourceProvider(cancellationToken: CancellationToken, loadArgs: Array<PriceApi.LoadDataRequest>)
		: Promise<Array<PriceApi.HistoricalPrices>> {
		if (this._log.isTraceEnabled) {
			this._log.trace("managerSourceProvider()... args: ", loadArgs);
		}

		this._log.trace("Parse LoadDataRequest to MultyLoadDataRequest");
		const multyLoadDataRequest: PriceApi.MultyLoadData = parseToMultyType(loadArgs);

		this._log.trace("Create array sourcesystem id which need syncs price");
		const sourceIds: Array<string> = Object.keys(multyLoadDataRequest);

		const taskSourceResults: Array<Array<PriceApi.HistoricalPrices>> = [];
		const taskSources: Array<Promise<void>> = [];
		const countSources: number = sourceIds.length;
		for (let i = 0; i < countSources; i++) {
			const sourceId = sourceIds[i];
			if (this._log.isTraceEnabled) {
				this._log.trace(`Get sourcesystem id: ${sourceId}`);
			}
			const source: PriceLoader | undefined = this._sourceProviders.find(sourceProvider => sourceProvider.sourceId === sourceId);

			if (source !== undefined) {
				taskSources.push(
					source
						.loadPrices(cancellationToken, multyLoadDataRequest[sourceId])
						.then(result => { taskSourceResults.push(result); })
				);
			} else {
				// TODO: Should be exception
				this._log.error(`Not implement yet ${source}`);
			}
		}

		const errors: Array<Error> = [];
		await Promise.all(
			taskSources.map(taskSource => taskSource.catch(err => { errors.push(wrapErrorIfNeeded(err)); }))
		);
		if (errors.length > 0) {
			throw new AggregateError(errors);
		}

		const friendlyPrices: Array<PriceApi.HistoricalPrices> = taskSourceResults.reduce((previous, current) => {
			return previous.concat(current);
		}, []);

		if (this._log.isTraceEnabled) {
			this._log.trace(`return result: ${friendlyPrices}`);
		}
		return friendlyPrices;
	}

	private async _onRealtimePriceStream(event: RealtimePriceStream.Event | Error): Promise<void> {
		if (event instanceof Error) {
			this._log.fatal("Unexpected error for RealtimePriceStream. Normally RealtimePriceStream should never close the channel", event);
			return;
		}

		this.__logStatusData.coingetMessages++;

		const data: RealtimePriceStream.Notification = event.data;

		await this._currentPriceManager.updatePrice(
			data.date, data.marketCurrency, data.tradeCurrency, this._aggregatedPriceSourceName, data.price
		);
		await this._currentPriceManager.updatePrice(
			data.date, data.marketCurrency, data.tradeCurrency, data.sourceSystem, data.price
		);
	}


	private async _onSyncTimer() {
		if (this.__syncIntervalExecutionFlag === true) { return; }
		this.__syncIntervalExecutionFlag = true;

		try {
			if (this._intrestedPairs.length > 0) {
				const intrestedPairs: { [tradeCurrency: string]: Array<string> } = {};

				for (const pair of this._intrestedPairs) {
					const splittedPair = pair.split("/");
					if (splittedPair.length !== 2) {
						return; // skip incorrect pair
					}
					const [tradeCurrency, marketCurrency] = splittedPair;
					if (!(tradeCurrency in intrestedPairs)) { intrestedPairs[tradeCurrency] = []; }
					intrestedPairs[tradeCurrency].push(marketCurrency);
				}

				const errors: Array<Error> = [];
				const tasks = _.entries(intrestedPairs).map(async ([tradeCurrency, marketCurrencies]) => {
					try {
						const now = new Date();
						const cryptoComparePrices = await this._cryptoCompareApiClient.getPrices(
							this._disposingCancellationTokenSource.token, marketCurrencies, tradeCurrency
						);
						this.__logStatusData.cryptocompareCalls++;

						for (const [marketCurrency, cryptoComparePrice] of _.entries(cryptoComparePrices)) {
							await this._currentPriceManager.updatePrice(now, marketCurrency, tradeCurrency, this._aggregatedPriceSourceName, cryptoComparePrice);
							await this._currentPriceManager.updatePrice(now, marketCurrency, tradeCurrency, "CRYPTOCOMPARE", cryptoComparePrice);
						}
					} catch (e) {
						if (e instanceof CryptoCompareApiClient.CryptoCompareApiError) {
							if (this._log.isTraceEnabled || this._log.isInfoEnabled) {
								const pairs: string = marketCurrencies.map(marketCurrency => `${tradeCurrency}/${marketCurrency}`).join(", ");
								if (this._log.isInfoEnabled) {
									this._log.info(`Cannot get price for pairs ${pairs} due inner error '${e.message}'`);
								}
								if (this._log.isTraceEnabled) {
									this._log.trace(`Cannot get price for pairs ${pairs} due inner error '${e.message}'`, e, e.rawData);
								}
							}
						} else {
							throw e;
						}
					}
				}).map(promise => promise.catch(e => errors.push(wrapErrorIfNeeded(e))));
				await Promise.all(tasks);
				if (errors.length > 0) { throw new AggregateError(errors); }
			}
		} catch (e) {
			const err = wrapErrorIfNeeded(e);
			this._log.debug("Cannot get price from Compare.", err.message);
			this._log.trace("Cannot get price from Compare.", err);
		} finally {
			this.__syncIntervalExecutionFlag = false;
		}
	}

	private async _onStatusTimer() {
		this._log.info("Status", JSON.stringify(this.__logStatusData));
		this.__logStatusData.coingetMessages = 0;
		this.__logStatusData.cryptocompareCalls = 0;
	}
}

export namespace PriceApiImpl {
	export interface Opts {
		readonly storageFactory: () => Storage;
		readonly sourceProviders: Array<PriceLoader>;
		readonly coingetRecorderStreamRedisURL: URL;
		readonly log?: Logger;
		/**
		 * @default ZXTRADER
		 */
		readonly aggregatedPriceSourceName?: string;
	}
}


function validateDate(args: Array<PriceApi.Argument>) {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const ts = arg.ts.toString();
		const isValid = moment(ts, "YYYYMMDDHHmmss", true).isValid();
		if (!isValid) {
			throw new PriceApi.InvalidDateError(`Invalid format date ${ts}`);
		}
	}
}
function parseToMultyType(loadArgs: Array<PriceApi.LoadDataRequest>): PriceApi.MultyLoadData {
	const multyLoadDataRequest: { [sourceId: string]: Array<PriceApi.LoadDataArgs>; } = {};

	for (let i = 0; i < loadArgs.length; i++) {
		const loadArg = loadArgs[i];
		const sourceId = loadArg.sourceId;
		if (!(sourceId in multyLoadDataRequest)) {
			multyLoadDataRequest[sourceId] = [];
		}
		multyLoadDataRequest[sourceId].push({
			ts: loadArg.ts,
			marketCurrency: loadArg.marketCurrency,
			tradeCurrency: loadArg.tradeCurrency
		});
	}

	return multyLoadDataRequest;
}
// function getSource(sources: Array<PriceLoader>, sourcesytemId: string): PriceLoader | null {
// 	for (let n = 0; n < sources.length; n++) {
// 		const source = sources[n];
// 		if (source.sourceId === sourcesytemId) {
// 			return source;
// 		}
// 	}
// 	// if don't exist source return null
// 	return null;
// }


// namespace CurrentPriceMap {
// 	export interface Pair {
// 		readonly marketCurrency: string;
// 		readonly tradeCurrency: string;
// 	}
// 	export function filter(map: CurrentPriceMap, pair: ReadonlyArray<Pair>, sourceSystems: ReadonlyArray<string>): CurrentPriceMap {
// 		return map;
// 	}
// }

interface Pair {
	readonly marketCurrency: string;
	readonly tradeCurrency: string;
}

class RealtimePriceManager {
	public readonly currentPriceMap: RealtimePriceManager.CurrentPriceMap;
	//private _freezeUpdates: Map<CurrentPriceManager.PriceUpdateChannel, Financial> | null;

	public constructor() {
		this.currentPriceMap = {};
	}

	public getPrice(
		marketCurrency: string, tradeCurrency: string, sourceSystem: string
	): Financial | null {
		if (marketCurrency in this.currentPriceMap) {
			const marketCurrencyTuple = this.currentPriceMap[marketCurrency];
			if (tradeCurrency in marketCurrencyTuple) {
				const tradeCurrencyTuple = marketCurrencyTuple[tradeCurrency];
				if (sourceSystem in tradeCurrencyTuple) {
					const sourceSystemTuple = tradeCurrencyTuple[sourceSystem];
					return sourceSystemTuple.price;
				}
			}
		}

		return null;
	}

	public getPriceChannel(
		marketCurrency: string, tradeCurrency: string, sourceSystem: string
	): RealtimePriceManager.PriceUpdateChannel {
		if (!(marketCurrency in this.currentPriceMap)) { this.currentPriceMap[marketCurrency] = {}; }
		const marketCurrencyTuple = this.currentPriceMap[marketCurrency];

		if (!(tradeCurrency in marketCurrencyTuple)) { marketCurrencyTuple[tradeCurrency] = {}; }
		const tradeCurrencyTuple = marketCurrencyTuple[tradeCurrency];

		if (!(sourceSystem in tradeCurrencyTuple)) {
			const sourceSystemTuple = {
				channel: new RealtimePriceManager.PriceUpdateChannel(),
				price: null
			};
			tradeCurrencyTuple[sourceSystem] = sourceSystemTuple;
			return sourceSystemTuple.channel;
		} else {
			const sourceSystemTuple = tradeCurrencyTuple[sourceSystem];
			return sourceSystemTuple.channel;
		}
	}

	public filter(
		pairs: ReadonlyArray<Pair>, sourceSystems: ReadonlyArray<string>
	): PriceApi.ChangePriceNotification.Data["prices"] {
		const prices: {
			[marketCurrency: string]: {
				[tradeCurrency: string]: {
					[sourceSystem: string]: Financial | null;
				};
			};
		} = {};

		for (const pair of pairs) {
			const { marketCurrency, tradeCurrency } = pair;

			if (!(marketCurrency in prices)) { prices[marketCurrency] = {}; }
			const targetMarketCurrencyTuple = prices[marketCurrency];

			if (!(tradeCurrency in targetMarketCurrencyTuple)) { targetMarketCurrencyTuple[tradeCurrency] = {}; }
			const targetTradeCurrencyTuple = targetMarketCurrencyTuple[tradeCurrency];

			for (const sourceSystem of sourceSystems) {

				if (marketCurrency in this.currentPriceMap) {
					const sourceMarketCurrencyTuple = this.currentPriceMap[marketCurrency];

					if (tradeCurrency in sourceMarketCurrencyTuple) {

						const sourceTradeCurrencyTuple = sourceMarketCurrencyTuple[tradeCurrency];
						if (sourceSystem in sourceTradeCurrencyTuple) {

							const price = sourceTradeCurrencyTuple[sourceSystem].price;
							if (price !== null) {

								targetTradeCurrencyTuple[sourceSystem] = price;
								continue;
							}
						}
					}

				}

				targetTradeCurrencyTuple[sourceSystem] = null;
			}
		}

		return prices;
	}

	public updatePrice(
		date: Date, marketCurrency: string, tradeCurrency: string, sourceSystem: string, price: Financial
	): void | Promise<void> {
		if (!(marketCurrency in this.currentPriceMap)) { this.currentPriceMap[marketCurrency] = {}; }
		const marketCurrencyTuple = this.currentPriceMap[marketCurrency];

		if (!(tradeCurrency in marketCurrencyTuple)) { marketCurrencyTuple[tradeCurrency] = {}; }
		const tradeCurrencyTuple = marketCurrencyTuple[tradeCurrency];

		if (!(sourceSystem in tradeCurrencyTuple)) {
			tradeCurrencyTuple[sourceSystem] = {
				channel: new RealtimePriceManager.PriceUpdateChannel(),
				price: price
			};
			return;
		} else {
			const sourceSystemTuple = tradeCurrencyTuple[sourceSystem];
			sourceSystemTuple.price = price;
			return sourceSystemTuple.channel.notifyUpdate(date, price);
		}
	}
}
namespace RealtimePriceManager {
	export interface CurrentPriceMap {
		[marketCurrency: string]: {
			[tradeCurrency: string]: {
				[sourceSystem: string]: {
					channel: PriceUpdateChannel;
					price: Financial | null;
				};
			};
		};
	}

	export type PriceUpdateEvent = SubscriberChannel.Event<{ readonly price: Financial, readonly date: Date; }>;

	export class PriceUpdateChannel implements SubscriberChannel<{ readonly price: Financial, readonly date: Date; }> {
		public notifyUpdate(date: Date, newPrice: Financial): void | Promise<void> {
			return this.notify({ data: { date, price: newPrice } });
		}
	}
	export interface PriceUpdateChannel extends SubscriberChannelMixin<{ readonly price: Financial, readonly date: Date; }> { }
	SubscriberChannelMixin.applyMixin(PriceUpdateChannel);
}


function emulatorPriceChangingByNoise(
	prices: PriceApi.ChangePriceNotification.Data["prices"],
	noise: number
): PriceApi.ChangePriceNotification.Data["prices"] {
	const pricesWithNoise: PriceApi.ChangePriceNotification.Data["prices"] =
		_.mapValues(prices, marketCurrencyTuple => {
			return _.mapValues(marketCurrencyTuple, tradeCurrencyTuple => {
				return _.mapValues(tradeCurrencyTuple, sourceSystemPrice => {
					if (sourceSystemPrice === null) { return null; }

					const noiseValue = financial.parse(((Math.random() - 0.5) * noise).toFixed(8));

					return financial.add(
						sourceSystemPrice,
						financial.multiply(noiseValue, sourceSystemPrice)
					);
				});
			});
		});

	return pricesWithNoise;
}
