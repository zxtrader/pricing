import { CancellationToken, Financial, Logger } from "@zxteam/contract";
import { DUMMY_CANCELLATION_TOKEN, ManualCancellationTokenSource } from "@zxteam/cancellation";
import { wrapErrorIfNeeded, ArgumentError, InvalidOperationError, AggregateError } from "@zxteam/errors";
import loggerFactory from "@zxteam/logger";
import { Initable } from "@zxteam/disposable";

import moment = require("moment");
import * as path from "path";
import { EventEmitter } from "events";
import { setInterval, clearInterval } from "timers";

import { PriceLoader } from "../priceLoader/PriceLoader";
import { Storage } from "../storage/Storage";
import { CryptoCompareApiClient } from "../clients/CryptoCompareApiClient";
import { PriceService } from "./PriceService";


const { name: serviceName, version } = require(path.join(__dirname, "..", "..", "package.json"));

export class PriceServiceImpl extends Initable implements PriceService {
	private readonly _log: Logger;
	private readonly _notificationEmitter: EventEmitter;
	private readonly _changeRateWatchers: Map<string/*market key*/, {
		destroy(): void;
		addChanel(channel: PriceService.ChangeRateNotification.Channel): void;
		removeChanel(channel: PriceService.ChangeRateNotification.Channel): void;
	}>;
	private readonly _cryptoCompareApiClient: CryptoCompareApiClient;
	private readonly _storageFactory: () => Storage;
	private readonly _sourceProviders: Array<PriceLoader>;
	private readonly _sourcesId: Array<string>;
	private __storage: Storage | null;

	constructor(storageFactory: () => Storage, sourceProviders: Array<PriceLoader>, log?: Logger) {
		super();
		this._log = log || loggerFactory.getLogger("PriceService");
		this._notificationEmitter = new EventEmitter();
		this._changeRateWatchers = new Map();
		this._storageFactory = storageFactory;
		this._sourceProviders = sourceProviders;
		this._sourcesId = sourceProviders.map((source) => source.sourceId);
		this._cryptoCompareApiClient = new CryptoCompareApiClient(serviceName, this._log);
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
		helpers.validateDate(args);

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


	public async createChangeRateSubscriber(
		cancellationToken: CancellationToken, marketCurrency: string, tradeCurrency: string
	): Promise<PriceService.ChangeRateNotification.Channel> {
		//const eventKey: string = `${exchangeId}:${marketCurrency}:${tradeCurrency}`;
		const eventKey: string = `${marketCurrency}:${tradeCurrency}`; // Temporaty implementation without exchangeId

		let watcher = this._changeRateWatchers.get(eventKey);
		if (watcher === undefined) {
			const watchCancellationToken = new ManualCancellationTokenSource();
			const timer = setInterval(async () => {
				try {
					const now = new Date();
					const ccPrice: Financial = await this._cryptoCompareApiClient
						.getPrice(watchCancellationToken.token, marketCurrency, tradeCurrency);
					this._notificationEmitter.emit(eventKey, { date: now, price: ccPrice });
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

		const onChangeRate = (data: any) => {
			handlers.forEach(handler => {
				try {
					handler({ data });
				} catch (e) {
					this._log.warn("Unexpected error in handler");
					this._log.debug("Unexpected error in handler", e.messageÎ);
					this._log.trace("Unexpected error in handler", e);
				}
			});
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
	}

	protected async onDispose() {
		await this._cryptoCompareApiClient.dispose();
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
		const multyLoadDataRequest: PriceService.MultyLoadData =
			helpers.parseToMultyType(loadArgs);

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
			const source: PriceLoader | null = helpers.getSource(this._sourceProviders, sourceId);

			if (source !== null) {
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
}

namespace helpers {
	export function validateDate(args: Array<PriceService.Argument>) {
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const ts = arg.ts.toString();
			const isValid = moment(ts, "YYYYMMDDHHmmss", true).isValid();
			if (!isValid) {
				throw new PriceService.InvalidDateError(`Invalid format date ${ts}`);
			}
		}
	}
	export function parseToMultyType(loadArgs: Array<PriceService.LoadDataRequest>): PriceService.MultyLoadData {
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
	export function getSource(sources: Array<PriceLoader>, sourcesytemId: string): PriceLoader | null {
		for (let n = 0; n < sources.length; n++) {
			const source = sources[n];
			if (source.sourceId === sourcesytemId) {
				return source;
			}
		}
		// if don't exist source return null
		return null;
	}
}

