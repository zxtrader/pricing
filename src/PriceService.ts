import { Logger, CancellationToken } from "@zxteam/contract";
import { StorageProvider } from "./providers/storage/contract";
import { SourceProvider } from "./providers/source/contract";
import { ArgumentException } from "@zxnode/base";
import { Task } from "ptask.js";

export class PriceService {
	private readonly _storageProvider: StorageProvider;
	private readonly _sourceProvider: SourceProvider;
	private readonly _logger: Logger;

	constructor(storageProvider: StorageProvider, sourceProvider: SourceProvider, logger: Logger) {
		this._storageProvider = storageProvider;
		this._sourceProvider = sourceProvider;
		this._logger = logger;
	}

	public getHistoricalPrices(cancellationToken: CancellationToken, args: Array<price.Argument>)
		: Task<Array<price.Prices>> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("getHistoricalPrices()... args: ", args);
			}
			if (args.length === 0) {
				throw new ArgumentException("Don't have argument");
			}

			this._logger.trace("Check prices in storage provide");
			const loadDataRequest: price.LoadDataRequest = await this._storageProvider.loadEmptyPrices(ct, args);

			if (this._logger.isTraceEnabled) {
				this._logger.trace(`Checking exsist price which need load from sources ${Object.keys(loadDataRequest).length}`);
			}
			if (Object.keys(loadDataRequest).length > 0) {

				this._logger.trace("Loading prices from sources");
				const newPrices: price.HistoricalPrices = await this._sourceProvider.loadPrices(ct, loadDataRequest);

				this._logger.trace("Save new prices to storage provide");
				await this._storageProvider.savePrices(ct, newPrices);
			}

			this._logger.trace("Read prices from storage provider");
			const friendlyPrices: Array<price.Prices> = await this._storageProvider.findPrices(ct, args);

			return friendlyPrices;
		}, cancellationToken);
	}
}

export namespace price {
	export interface Argument {
		ts: number;
		marketCurrency: string;
		tradeCurrency: string;
		sourceSystemId?: string;
		requiredAllSourceSystems: boolean;
	}
	export interface Prices {
		[ts: number]: MarketPrices;
	}
	export interface MarketPrices {
		[marketCurrency: string]: TradePrices;
	}
	export interface TradePrices {
		[tradeCurrency: string]: TradingPrice;
	}
	export interface TradingPrice {
		avg: Price | null;
		sources?: SourcePrices;
	}
	export interface SourcePrices {
		[sourceSystemId: string]: Price;
	}
	export interface Price {
		price: string;
	}
	export interface LoadDataRequest {
		/** Source system id (ex. CRYPTOCOMPARE) */
		[source: string]: {
			/** Timestamp format YYYYMMDDHHMMSS */
			[ts: number]: {
				/** Array of marketCurrency */
				[tradeCurrency: string]: Array<string>
			};
		};
	}
	/** HistoricalPrices:
	 * {
	 * 	"CRYPTOCOMPARE": {
	 * 		20180101101010: {
	 * 			"ETH": {
	 * 				"BTC": 0.002616,
	 * 				"USD": 1.13,
	 * 				"EUR":1.04
	 * 				}
	 * 			}
	 * 		}
	 * 	}
	 */
	export interface HistoricalPrices {
		/** Source system id (ex. CRYPTOCOMPARE) */
		[source: string]: {
			/** Timestamp format YYYYMMDDHHMMSS */
			[ts: number]: {
				/** Code trade currency */
				[tradeCurrency: string]: {
					/** Code market currency ex: "USD": 150.13,*/
					[marketCurrency: string]: number;
				};
			};
		};
	}
}
