import { CancellationToken, Initable } from "@zxteam/contract";

export interface Storage extends Initable {

	/** Create data for loading price on sources */
	filterEmptyPrices(cancellationToken: CancellationToken, args: Array<price.Argument>, sources: Array<string>)
		: Promise<Array<price.LoadDataRequest>>;

	/** Save new price to storage provide */
	savePrices(cancellationToken: CancellationToken, newPrices: Array<price.HistoricalPrices>)
		: Promise<void>;

	/** Find prices */
	findPrices(cancellationToken: CancellationToken, filter: { ts: number; marketCurrency: string; tradeCurrency: string; })
		: Promise<price.Timestamp>;

}

export namespace Storage {

}
export interface Argument {

	sourceId?: string;
	requiredAllSourceIds: boolean;
}
