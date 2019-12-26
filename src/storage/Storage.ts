import { CancellationToken, Initable } from "@zxteam/contract";
import { PriceApi } from "../api/PriceApi";

export interface Storage extends Initable {

	/** Create data for loading price on sources */
	filterEmptyPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>, sources: Array<string>)
		: Promise<Array<PriceApi.LoadDataRequest>>;

	/** Save new price to storage provide */
	savePrices(cancellationToken: CancellationToken, newPrices: Array<PriceApi.HistoricalPrices>)
		: Promise<void>;

	/** Find prices */
	findPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>): Promise<PriceApi.Timestamp>;
}

export namespace Storage {

}
