import { CancellationToken, Task as TaskLike } from "@zxteam/contract";
import { price } from "../../PriceService";

export interface StorageProvider {

	/** Create data for loading price on sources */
	loadEmptyPrices(cancellationToken: CancellationToken, args: Array<price.Argument>): TaskLike<price.LoadDataRequest>;

	/** Save new price to storage provide */
	savePrices(cancellationToken: CancellationToken, newPrices: price.HistoricalPrices): TaskLike<void>;

	/** Find prices */
	findPrices(cancellationToken: CancellationToken, args: Array<price.Argument>): TaskLike<Array<price.Timestamp>>;
}
