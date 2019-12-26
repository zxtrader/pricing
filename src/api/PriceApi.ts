import { CancellationToken, Financial, SubscriberChannel, Disposable } from "@zxteam/contract";

export interface PriceApi {
	createChangePriceSubscriber(
		cancellationToken: CancellationToken, threshold: number, pairs: ReadonlyArray<string>, exchanges: ReadonlyArray<string>
	): Promise<PriceApi.ChangePriceNotification.Channel>;

	createChangeRateSubscriber(
		cancellationToken: CancellationToken, threshold: number, marketCurrency: string, tradeCurrency: string
	): Promise<PriceApi.ChangeRateNotification.Channel>;

	getHistoricalPrices(
		cancellationToken: CancellationToken, args: Array<PriceApi.Argument>
	): Promise<PriceApi.Timestamp>;

	ping(
		cancellationToken: CancellationToken, echo: string
	): Promise<{ readonly echo: string; readonly time: Date; readonly version: string; }>;
}


export namespace PriceApi {
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

	export namespace ChangePriceNotification {
		export interface Data {
			readonly date: Date;
			readonly prices: {
				readonly [marketCurrency: string]: {
					readonly [tradeCurrency: string]: {
						readonly [sourceSystem: string]: Financial | null;
					};
				};
			};
		}
		export type Callback = SubscriberChannel.Callback<Data, Event>;
		export type Channel = SubscriberChannel<Data> & Disposable;
		export type Event = SubscriberChannel.Event<Data>;
	}

	export namespace ChangeRateNotification {
		export interface Data {
			readonly date: Date;
			readonly price: Financial;
		}
		export type Callback = SubscriberChannel.Callback<Data, Event>;
		export type Channel = SubscriberChannel<Data> & Disposable;
		export type Event = SubscriberChannel.Event<Data>;
	}

	export class InvalidDateError extends Error { }
}
