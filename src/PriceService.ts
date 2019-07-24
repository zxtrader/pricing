import * as zxteam from "@zxteam/contract";
import { Task, DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
import loggerFactory from "@zxteam/logger";
import { Initable } from "@zxteam/disposable";

import moment = require("moment");
import * as path from "path";
import { EventEmitter } from "events";
import { setInterval, clearInterval } from "timers";

import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { CryptoCompareApiClient } from "./clients/CryptoCompareApiClient";


const { name: serviceName, version } = require(path.join(__dirname, "../package.json"));

export class PriceService extends Initable implements PriceService {
	private readonly _log: zxteam.Logger;
	private readonly _notificationEmitter: EventEmitter;
	private readonly _changeRateWatchers: Map<string/*market key*/, {
		destroy(): void;
		addChanel(c: Notification.ChangeRate.Channel): void;
		removeChanel(c: Notification.ChangeRate.Channel): void;
	}>;
	private readonly _cryptoCompareApiClient: CryptoCompareApiClient;
	private readonly _storageProvider: StorageProvider;
	private readonly _sourceProviders: Array<SourceProvider>;
	private readonly _sourcesId: Array<string>;
	private _storage: StorageProvider | null;

	constructor(storageProvider: StorageProvider, sourceProviders: Array<SourceProvider>, log?: zxteam.Logger) {
		super();
		this._log = log || loggerFactory.getLogger("PriceService");
		this._notificationEmitter = new EventEmitter();
		this._changeRateWatchers = new Map();
		this._storageProvider = storageProvider;
		this._sourceProviders = sourceProviders;
		this._sourcesId = sourceProviders.map((source) => source.sourceId);
		this._cryptoCompareApiClient = new CryptoCompareApiClient(serviceName, this._log);
		this._storage = null;
	}

	/**
	 * Get historical prices for few sources provider
	 * @param cancellationToken Cancellation Token allows your to cancel execution process
	 * @param args criteria for price search
	 */
	public async getHistoricalPrices(cancellationToken: zxteam.CancellationToken, args: Array<price.Argument>)
		: Promise<price.Timestamp> {
		this.verifyInitializedAndNotDisposed();

		if (this._log.isTraceEnabled) {
			this._log.trace("getHistoricalPrices()... args: ", args);
		}
		if (args.length === 0) {
			throw new ArgumentException("Wrong arguments");
		}

		this._log.trace("Validate date");
		helpers.validateDate(args);

		this._log.trace("Check prices in storage provide");
		const filterEmptyPrices: Array<price.LoadDataRequest> =
			await this._storageProvider.filterEmptyPrices(cancellationToken, args, this._sourcesId);

		this._log.trace("Check cancellationToken for interrupt");
		cancellationToken.throwIfCancellationRequested();

		if (this._log.isTraceEnabled) {
			this._log.trace(`Checking exsist price which need load from sources ${filterEmptyPrices.length}`);
		}

		if (filterEmptyPrices.length > 0) {

			this._log.trace("Loading prices from sources through function manager");
			const newPrices: Array<price.HistoricalPrices> =
				await this.managerSourceProvider(cancellationToken, filterEmptyPrices);

			this._log.trace("Check cancellationToken for interrupt");
			cancellationToken.throwIfCancellationRequested();

			if (newPrices.length > 0) {
				this._log.trace("Save new prices to storage provide");
				await this._storageProvider.savePrices(cancellationToken, newPrices);

				this._log.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();
			}
		}

		this._log.trace("Read prices from storage provider");
		const friendlyPrices: price.Timestamp = await this._storageProvider.findPrices(cancellationToken, args);

		if (this._log.isTraceEnabled) {
			this._log.trace(`Return result: ${friendlyPrices}`);
		}
		return friendlyPrices;
	}

	public async ping(
		cancellationToken: zxteam.CancellationToken, echo: string
	): Promise<{ readonly echo: string; readonly time: Date; readonly version: string; }> {
		return {
			echo,
			time: new Date(),
			version
		};
	}


	public async createChangeRateSubscriber(
		cancellationToken: zxteam.CancellationToken, marketCurrency: string, tradeCurrency: string
	): Promise<Notification.ChangeRate.Channel> {
		//const eventKey: string = `${exchangeId}:${marketCurrency}:${tradeCurrency}`;
		const eventKey: string = `${marketCurrency}:${tradeCurrency}`; // Temporaty implementation without exchangeId

		let watcher = this._changeRateWatchers.get(eventKey);
		if (watcher === undefined) {
			const watchCancellationToken = Task.createCancellationTokenSource();
			const timer = setInterval(async () => {
				try {
					const now = new Date();
					const ccPrice: zxteam.Financial = await this._cryptoCompareApiClient
						.getPrice(watchCancellationToken.token, marketCurrency, tradeCurrency);
					this._notificationEmitter.emit(eventKey, { date: now, price: ccPrice });
				} catch (e) {
					if (this._log.isWarnEnabled) { this._log.warn(`Failed to get price for ${eventKey}`); }
					if (this._log.isDebugEnabled) { this._log.debug(`Failed to get price for ${eventKey}. Inner error: ${e.message}`); }
					if (this._log.isTraceEnabled) { this._log.trace(`Failed to get price for ${eventKey}.`, e); }
				}
			}, 1000);
			const channels = new Set<Notification.ChangeRate.Channel>();
			watcher = Object.freeze({
				destroy() {
					clearInterval(timer);
					watchCancellationToken.cancel();
				},
				addChanel: (c: Notification.ChangeRate.Channel) => {
					channels.add(c);
				},
				removeChanel: (c: Notification.ChangeRate.Channel) => {
					channels.delete(c);
					if (channels.size === 0) {
						clearInterval(timer);
						this._changeRateWatchers.delete(eventKey);
					}
				}
			});
			this._changeRateWatchers.set(eventKey, watcher);
		}

		const handlers: Set<
			zxteam.SubscriberChannel.Callback<Notification.ChangeRate.Data>
		> = new Set();

		const onChangeRate = (data: any) => {
			handlers.forEach(handler => {
				try {
					handler(DUMMY_CANCELLATION_TOKEN, { data });
				} catch (e) {
					this._log.warn("Unexpected error in handler");
					this._log.debug("Unexpected error in handler", e.messageÎ);
					this._log.trace("Unexpected error in handler", e);
				}
			});
		};

		const channelWatcher = watcher;
		const channel: Notification.ChangeRate.Channel = Object.freeze({
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

	protected async onInit(cancellationToken: zxteam.CancellationToken) {
		this._log.debug("Initializing");
		const storage = this._storageProvider;
		await storage.init(cancellationToken);
		this._storage = storage;
	}
	protected async onDispose() {
		this._log.debug("Disposing");
		await this._cryptoCompareApiClient.dispose();
		if (this._storage !== null) {
			const storage: StorageProvider = this._storage;
			this._storage = null;
			await storage.dispose();
		}
		this._log.info("Disposed");
	}

	private async managerSourceProvider(cancellationToken: zxteam.CancellationToken, loadArgs: Array<price.LoadDataRequest>)
		: Promise<Array<price.HistoricalPrices>> {
		if (this._log.isTraceEnabled) {
			this._log.trace("managerSourceProvider()... args: ", loadArgs);
		}

		this._log.trace("Parse LoadDataRequest to MultyLoadDataRequest");
		const multyLoadDataRequest: price.MultyLoadData =
			helpers.parseToMultyType(loadArgs);

		this._log.trace("Create array sourcesystem id which need syncs price");
		const sourceIds: Array<string> = Object.keys(multyLoadDataRequest);

		const taskSources: Array<zxteam.Task<any>> = [];
		const countSources: number = sourceIds.length;
		for (let i = 0; i < countSources; i++) {
			const sourceId = sourceIds[i];
			if (this._log.isTraceEnabled) {
				this._log.trace(`Set sourcesystem id: ${sourceId}`);
			}

			this._log.trace("Get source provider object for get price");
			const source: SourceProvider | null = helpers.getSource(this._sourceProviders, sourceId);

			if (source) {
				taskSources.push(source.loadPrices(cancellationToken, multyLoadDataRequest[sourceId]));
			} else {
				// TODO: Should be exception
				this._log.error(`Not implement yet ${source}`);
			}
		}

		await Task.waitAll(taskSources);
		const friendlyPrices: Array<price.HistoricalPrices> = taskSources.reduce((previous, current) => {
			return previous.concat(current.result);
		}, []);

		if (this._log.isTraceEnabled) {
			this._log.trace(`return result: ${friendlyPrices}`);
		}
		return friendlyPrices;
	}
}

export namespace helpers {
	export function validateDate(args: Array<price.Argument>) {
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const ts = arg.ts.toString();
			const isValid = moment(ts, "YYYYMMDDHHmmss", true).isValid();
			if (!isValid) {
				throw new InvalidDateError(`Invalid format date ${ts}`);
			}
		}
	}
	export function parseToMultyType(loadArgs: Array<price.LoadDataRequest>): price.MultyLoadData {
		const multyLoadDataRequest: { [sourceId: string]: Array<price.LoadDataArgs>; } = {};

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
	export function getSource(sources: Array<SourceProvider>, sourcesytemId: string): SourceProvider | null {
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

export namespace price {
	export interface Argument {
		ts: number;
		marketCurrency: string;
		tradeCurrency: string;
		sourceId?: string;
		requiredAllSourceIds: boolean;
	}
	export interface Timestamp {
		[ts: number]: Market;
	}
	export interface Market {
		[marketCurrency: string]: Trade;
	}
	export interface Trade {
		[tradeCurrency: string]: Average;
	}
	export interface Average {
		avg: Price | null;
		sources?: SourceId;
	}
	export interface SourceId {
		[sourceId: string]: Price;
	}
	export interface Price {
		price: string;
	}
	export interface MultyLoadData {
		/** Source id (ex. CRYPTOCOMPARE) */
		[sourceId: string]: ReadonlyArray<LoadDataArgs>;
	}
	export interface LoadDataBase {
		/** Timestamp format YYYYMMDDHHMMSS */
		ts: number;
		/** Code market currency */
		marketCurrency: string;
		/** Code trade currency */
		tradeCurrency: string;
	}
	export interface LoadDataResult extends LoadDataBase {
		/** Price can number or null */
		price: string | null;
	}
	export interface LoadDataRequest extends LoadDataBase {
		/** Source id (ex. CRYPTOCOMPARE) */
		sourceId: string;
	}

	export type LoadDataArgs = LoadDataBase;

	export interface HistoricalPrices {
		/** Source id (ex. CRYPTOCOMPARE) */
		sourceId: string;
		/** Timestamp format YYYYMMDDHHMMSS */
		ts: number;
		/** Code market currency */
		marketCurrency: string;
		/** Code trade currency */
		tradeCurrency: string;
		/** Price must be number */
		price: string;
	}
}

export interface PriceService {
	getHistoricalPrices(
		cancellationToken: zxteam.CancellationToken, args: Array<price.Argument>
	): Promise<price.Timestamp>;

	ping(
		cancellationToken: zxteam.CancellationToken, echo: string
	): Promise<{ readonly echo: string; readonly time: Date; readonly version: string; }>;
}
export namespace Notification {
	export namespace ChangeRate {
		export interface Data {
			date: Date;
			price: zxteam.Financial;
		}
		export type Channel = zxteam.SubscriberChannel<Data>;
	}
}


export class InvalidDateError extends Error { }
export class ArgumentException extends Error {
	public readonly name = "ArgumentError";
}
