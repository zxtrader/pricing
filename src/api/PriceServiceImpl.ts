import { CancellationToken, Financial, Logger, SubscriberChannel } from "@zxteam/contract";
import { DUMMY_CANCELLATION_TOKEN, ManualCancellationTokenSource, CancellationTokenSource } from "@zxteam/cancellation";
import { Disposable } from "@zxteam/disposable";
import { wrapErrorIfNeeded, ArgumentError, InvalidOperationError, AggregateError } from "@zxteam/errors";
import loggerFactory from "@zxteam/logger";
import { Initable } from "@zxteam/disposable";

import * as moment from "moment";
import * as path from "path";
import * as _ from "lodash";
import { EventEmitter } from "events";
import { setInterval, clearInterval } from "timers";

import { PriceLoader } from "../priceLoader/PriceLoader";
import { Storage } from "../storage/Storage";
import { CryptoCompareApiClient } from "../clients/CryptoCompareApiClient";
import { PriceService } from "./PriceService";
import { SubscriberChannelMixin } from "@zxteam/channels";

const { name: serviceName, version } = require(path.join(__dirname, "..", "..", "package.json"));

export class PriceServiceImpl extends Initable implements PriceService {
	private readonly _log: Logger;
	private readonly _disposingCancellationTokenSource: ManualCancellationTokenSource;
	private readonly _notificationEmitter: EventEmitter;
	private readonly _currentPriceManager: CurrentPriceManager;
	private readonly _changeRateWatchers: Map<string/*market key*/, {
		destroy(): void;
		addChanel(channel: PriceService.ChangeRateNotification.Channel): void;
		removeChanel(channel: PriceService.ChangeRateNotification.Channel): void;
	}>;
	private readonly _cryptoCompareApiClient: CryptoCompareApiClient;
	private readonly _storageFactory: () => Storage;
	private readonly _sourceProviders: Array<PriceLoader>;
	private readonly _sourcesId: Array<string>;
	private readonly _intrestedPairs: Array<string>;
	private __syncInterval: NodeJS.Timeout | null;
	private __syncIntervalExecutionFlag: boolean;
	private __storage: Storage | null;

	public constructor(storageFactory: () => Storage, sourceProviders: Array<PriceLoader>, log?: Logger) {
		super();
		this._log = log || loggerFactory.getLogger("PriceService");
		this._disposingCancellationTokenSource = new ManualCancellationTokenSource();
		this._notificationEmitter = new EventEmitter();
		this._currentPriceManager = new CurrentPriceManager();
		this._changeRateWatchers = new Map();
		this._storageFactory = storageFactory;
		this._sourceProviders = sourceProviders;
		this._sourcesId = sourceProviders.map((source) => source.sourceId);
		this._cryptoCompareApiClient = new CryptoCompareApiClient(serviceName, this._log);
		this._intrestedPairs = [];
		this.__syncInterval = null;
		this.__syncIntervalExecutionFlag = false;
		this.__storage = null;
	}

	/**
	 * Get historical prices for few sources provider
	 * @param cancellationToken Cancellation Token allows your to cancel execution process
	 * @param args criteria for price search
	 */
	public async getHistoricalPrices(cancellationToken: CancellationToken, args: Array<PriceService.Argument>)
		: Promise<PriceService.Timestamp> {
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
		const filterEmptyPrices: Array<PriceService.LoadDataRequest> =
			await this._storage.filterEmptyPrices(cancellationToken, args, this._sourcesId);

		this._log.trace("Check cancellationToken for interrupt");
		cancellationToken.throwIfCancellationRequested();

		if (this._log.isTraceEnabled) {
			this._log.trace(`Checking exsist price which need load from sources ${filterEmptyPrices.length}`);
		}

		if (filterEmptyPrices.length > 0) {

			this._log.trace("Loading prices from sources through function manager");
			const newPrices: Array<PriceService.HistoricalPrices> =
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
		const friendlyPrices: PriceService.Timestamp = await this._storage.findPrices(cancellationToken, args);

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
	): Promise<PriceService.ChangePriceNotification.Channel> {
		// В этом методе мы используем все каналы из CurrentPriceManager по интересующим парами/источникам
		// и заворачиваем события о об изменении цен, в ChangePriceNotification

		const handlers: Array<PriceService.ChangePriceNotification.Callback> = [];
		const priceChannels: Array<CurrentPriceManager.PriceUpdateChannel> = [];

		const friendlyExchanges = [...new Set(exchanges).add("ZXTRADER")];

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

		const priceChannelHandler = async (priceEvent: CurrentPriceManager.PriceUpdateEvent | Error) => {
			if (priceEvent instanceof Error) { return; }
			const { data: priceData } = priceEvent;

			const prices = this._currentPriceManager.filter(friendlyPairs, friendlyExchanges);

			for (const handler of handlers) {
				await handler({
					data: {
						date: priceData.date,
						prices
					}
				});
			}
		};

		for (const priceChannel of priceChannels) {
			priceChannel.addHandler(priceChannelHandler);
		}

		const channelAdapter: PriceService.ChangePriceNotification.Channel = Object.freeze({
			addHandler(cb) { handlers.push(cb); },
			removeHandler(cb) {
				const handlerIndex = handlers.indexOf(cb);
				if (handlerIndex !== -1) {
					handlers.splice(handlerIndex, 1);
				}
			},
			dispose: (): Promise<void> => {
				for (const priceChannel of priceChannels) {
					priceChannel.removeHandler(priceChannelHandler);
				}
				return Promise.resolve();
			}
		});

		return channelAdapter;
	}

	public async createChangeRateSubscriber(
		cancellationToken: CancellationToken, threshold: number, marketCurrency: string, tradeCurrency: string
	): Promise<PriceService.ChangeRateNotification.Channel> {
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
					const price = this._currentPriceManager.getPrice(marketCurrency, tradeCurrency, "ZXTRADER");
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
			const channels = new Set<PriceService.ChangeRateNotification.Channel>();
			watcher = Object.freeze({
				destroy() {
					clearInterval(timer);
					watchCancellationToken.cancel();
				},
				addChanel: (c: PriceService.ChangeRateNotification.Channel) => {
					channels.add(c);
				},
				removeChanel: (c: PriceService.ChangeRateNotification.Channel) => {
					channels.delete(c);
					if (channels.size === 0) {
						clearInterval(timer);
						this._changeRateWatchers.delete(eventKey);
					}
				}
			});
			this._changeRateWatchers.set(eventKey, watcher);
		}

		const handlers: Set<PriceService.ChangeRateNotification.Callback> = new Set();

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
		const channel: PriceService.ChangeRateNotification.Channel = Object.freeze({
			cb: null,
			addHandler: cb => { handlers.add(cb); },
			removeHandler: cb => { handlers.delete(cb); },
			dispose: (): Promise<void> => {
				this._notificationEmitter.removeListener(eventKey, onChangeRate);
				channelWatcher.removeChanel(channel);
				return Promise.resolve();
			}
		});

		this._notificationEmitter.on(eventKey, onChangeRate);

		watcher.addChanel(channel);

		return channel;
	}

	protected async onInit(cancellationToken: CancellationToken) {
		this._log.debug("Initializing");
		//await this._cryptoCompareApiClient.init(cancellationToken);
		const storage: Storage = this._storageFactory();
		await storage.init(cancellationToken);
		this.__storage = storage;
		this.__syncInterval = setInterval(this._onSyncTimer.bind(this), 2500);
	}

	protected async onDispose() {
		await this._cryptoCompareApiClient.dispose();
		if (this.__syncInterval !== null) {
			clearInterval(this.__syncInterval);
			this.__syncInterval = null;
		}
		if (this.__storage !== null) {
			const storage: Storage = this.__storage;
			this.__storage = null;
			await storage.dispose();
		}
	}

	private get _storage(): Storage {
		if (this.__storage === null) {
			throw new Error("Wrong oparation at current state. Did you init()?");
		}
		return this.__storage;
	}

	private async managerSourceProvider(cancellationToken: CancellationToken, loadArgs: Array<PriceService.LoadDataRequest>)
		: Promise<Array<PriceService.HistoricalPrices>> {
		if (this._log.isTraceEnabled) {
			this._log.trace("managerSourceProvider()... args: ", loadArgs);
		}

		this._log.trace("Parse LoadDataRequest to MultyLoadDataRequest");
		const multyLoadDataRequest: PriceService.MultyLoadData = parseToMultyType(loadArgs);

		this._log.trace("Create array sourcesystem id which need syncs price");
		const sourceIds: Array<string> = Object.keys(multyLoadDataRequest);

		const taskSourceResults: Array<Array<PriceService.HistoricalPrices>> = [];
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

		const friendlyPrices: Array<PriceService.HistoricalPrices> = taskSourceResults.reduce((previous, current) => {
			return previous.concat(current);
		}, []);

		if (this._log.isTraceEnabled) {
			this._log.trace(`return result: ${friendlyPrices}`);
		}
		return friendlyPrices;
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

				for (const [tradeCurrency, marketCurrencies] of _.entries(intrestedPairs)) {
					const now = new Date();
					const ccPrices = await this._cryptoCompareApiClient.getPrices(
						this._disposingCancellationTokenSource.token, marketCurrencies, tradeCurrency
					);

					for (const [marketCurrency, price] of _.entries(ccPrices)) {
						await this._currentPriceManager.updatePrice(now, marketCurrency, tradeCurrency, "ZXTRADER", price);
						await this._currentPriceManager.updatePrice(now, marketCurrency, tradeCurrency, "CRYPTOCOMPARE", price);
					}
				}
			}
		} catch (e) {
			const err = wrapErrorIfNeeded(e);
			this._log.debug("Cannot get price from Compare", err.message);
			this._log.trace("Cannot get price from Compare", err);
		} finally {
			this.__syncIntervalExecutionFlag = false;
		}
	}
}


function validateDate(args: Array<PriceService.Argument>) {
	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const ts = arg.ts.toString();
		const isValid = moment(ts, "YYYYMMDDHHmmss", true).isValid();
		if (!isValid) {
			throw new PriceService.InvalidDateError(`Invalid format date ${ts}`);
		}
	}
}
function parseToMultyType(loadArgs: Array<PriceService.LoadDataRequest>): PriceService.MultyLoadData {
	const multyLoadDataRequest: { [sourceId: string]: Array<PriceService.LoadDataArgs>; } = {};

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

class CurrentPriceManager {
	public readonly currentPriceMap: CurrentPriceManager.CurrentPriceMap;

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
	): CurrentPriceManager.PriceUpdateChannel {
		if (!(marketCurrency in this.currentPriceMap)) { this.currentPriceMap[marketCurrency] = {}; }
		const marketCurrencyTuple = this.currentPriceMap[marketCurrency];

		if (!(tradeCurrency in marketCurrencyTuple)) { marketCurrencyTuple[tradeCurrency] = {}; }
		const tradeCurrencyTuple = marketCurrencyTuple[tradeCurrency];

		if (!(sourceSystem in tradeCurrencyTuple)) {
			const sourceSystemTuple = {
				channel: new CurrentPriceManager.PriceUpdateChannel(),
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
	): PriceService.ChangePriceNotification.Data["prices"] {
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
				channel: new CurrentPriceManager.PriceUpdateChannel(),
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
namespace CurrentPriceManager {
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
