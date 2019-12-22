import { CancellationToken, Initable } from "@zxteam/contract";
import { PriceService } from "../api/PriceService";

export interface Storage extends Initable {

	/** Create data for loading price on sources */
	filterEmptyPrices(cancellationToken: CancellationToken, args: Array<PriceService.Argument>, sources: Array<string>)
		: Promise<Array<PriceService.LoadDataRequest>>;

	/** Save new price to storage provide */
	savePrices(cancellationToken: CancellationToken, newPrices: Array<PriceService.HistoricalPrices>)
		: Promise<void>;

	/** Find prices */
	findPrices(cancellationToken: CancellationToken, args: Array<PriceService.Argument>): Promise<PriceService.Timestamp>;
}

export namespace Storage {

}
