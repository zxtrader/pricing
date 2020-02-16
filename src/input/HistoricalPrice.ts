import { Financial } from "@zxteam/contract";

export interface HistoricalPrice {
	getPrice(date: Date, marketCurrency: string, tradeCurrency: string): Promise<Financial>;
}

export namespace HistoricalPrice {
	export interface Price {
		/**
		 * Date
		 */
		date: Date;

		/**
		 * Market currency
		 */
		marketCurrency: string;
		/**
		 * Trade currency
		 */

		tradeCurrency: string;

		/**
		 * Price
		 */
		price: Financial;
	}
}
