import { Task } from "@zxteam/task";
import loggerFactory from "@zxteam/logger";
import { ArgumentException } from "@zxnode/base";
import { Logger, CancellationToken } from "@zxteam/contract";
import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { Initable } from "@zxteam/disposable";

export class PriceService extends Initable {
	private readonly _storageProvider: StorageProvider;
	private readonly _sourceProviders: Array<SourceProvider>;
	private readonly _sourcesId: Array<string>;
	private readonly _logger: Logger = loggerFactory.getLogger("PriceService");

	constructor(storageProvider: StorageProvider, sourceProviders: Array<SourceProvider>) {
		super();
		this._storageProvider = storageProvider;
		this._sourceProviders = sourceProviders;
		this._sourcesId = sourceProviders.map((source) => source.sourceId);
	}

	public getHistoricalPrices(cancellationToken: CancellationToken, args: Array<price.Argument>)
		: Task<price.Timestamp> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("getHistoricalPrices()... args: ", args);
			}
			if (args.length === 0) {
				throw new ArgumentException("Don't have argument");
			}

			this._logger.trace("Check prices in storage provide");
			const filterEmptyPrices: Array<price.LoadDataRequest> = await this._storageProvider.filterEmptyPrices(ct, args, this._sourcesId);

			this._logger.trace("Check cancellationToken for interrupt");
			ct.throwIfCancellationRequested();

			if (this._logger.isTraceEnabled) {
				this._logger.trace(`Checking exsist price which need load from sources ${filterEmptyPrices.length}`);
			}

			if (filterEmptyPrices.length > 0) {

				this._logger.trace("Loading prices from sources through function manager");
				const newPrices: Array<price.HistoricalPrices> = await this.managerSourceProvider(ct, filterEmptyPrices);

				this._logger.trace("Check cancellationToken for interrupt");
				ct.throwIfCancellationRequested();

				this._logger.trace("Save new prices to storage provide");
				await this._storageProvider.savePrices(ct, newPrices);

				this._logger.trace("Check cancellationToken for interrupt");
				ct.throwIfCancellationRequested();
			}

			this._logger.trace("Read prices from storage provider");
			const friendlyPrices: price.Timestamp = await this._storageProvider.findPrices(ct, args);

			if (this._logger.isTraceEnabled) {
				this._logger.trace(`Return result: ${friendlyPrices}`);
			}
			return friendlyPrices;
		}, cancellationToken);
	}

	protected onInit() {
		//
	}
	protected onDispose() {
		//
	}

	private managerSourceProvider(cancellationToken: CancellationToken, loadArgs: Array<price.LoadDataRequest>)
		: Task<Array<price.HistoricalPrices>> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("managerSourceProvider()... args: ", loadArgs);
			}

			this._logger.trace("Declaration friendly response");
			let friendlyPrices: Array<price.HistoricalPrices> = [];

			this._logger.trace("Parse LoadDataRequest to MultyLoadDataRequest");
			const multyLoadDataRequest = helpers.parseToMultyType(loadArgs);

			this._logger.trace("Create array sourcesystem id which need syncs price");
			const sourceIds = Object.keys(multyLoadDataRequest);

			const countSources = sourceIds.length;
			for (let i = 0; i < countSources; i++) {
				const sourceId = sourceIds[i];
				if (this._logger.isTraceEnabled) {
					this._logger.trace(`Set sourcesystem id: ${sourceId}`);
				}

				this._logger.trace("Get source provider object for get price");
				const source = helpers.getSource(this._sourceProviders, sourceId);

				if (source) {
					this._logger.trace("Loading new price from source");
					const sourcePrice = await source.loadPrices(ct, { [sourceId]: multyLoadDataRequest[sourceId] });

					this._logger.trace("Check cancellationToken for interrupt");
					ct.throwIfCancellationRequested();

					this._logger.trace("Merge two results");
					Array.prototype.push.apply(friendlyPrices, sourcePrice);
				} else {
					this._logger.error("Not implement yet");
				}
			}

			if (this._logger.isTraceEnabled) {
				this._logger.trace(`return result: ${friendlyPrices}`);
			}
			return friendlyPrices;
		}, cancellationToken);
	}
}

export namespace helpers {
	export function parseToMultyType(loadArgs: Array<price.LoadDataRequest>): price.MultyLoadDataRequest {
		const multyLoadDataRequest: price.MultyLoadDataRequest = {};

		for (let i = 0; i < loadArgs.length; i++) {
			const loadArg = loadArgs[i];
			const sourceId = loadArg.sourceId;
			if (!(sourceId in multyLoadDataRequest)) {
				multyLoadDataRequest[sourceId] = [];
			}
			multyLoadDataRequest[sourceId].push({
				ts: loadArg.ts,
				marketCurrency: loadArg.marketCurrency,
				tradeCurrency: loadArg.tradeCurrency,
				price: loadArg.price
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
	export interface LoadDataRequest {
		/** Source id (ex. CRYPTOCOMPARE) */
		sourceId: string;
		/** Timestamp format YYYYMMDDHHMMSS */
		ts: number;
		/** Code market currency */
		marketCurrency: string;
		/** Code trade currency */
		tradeCurrency: string;
		/** Price can number or null */
		price: number | null;
	}
	export interface MultyLoadDataRequest {
		/** Source id (ex. CRYPTOCOMPARE) */
		[sourceId: string]: Array<LoadData>;
	}
	export interface LoadData {
		/** Timestamp format YYYYMMDDHHMMSS */
		ts: number;
		/** Code market currency */
		marketCurrency: string;
		/** Code trade currency */
		tradeCurrency: string;
		/** Price can number or null */
		price: number | null;
	}

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
		price: number;
	}
}
