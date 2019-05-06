import { price } from "../../PriceService";
import { CancellationToken, Task as TaskLike } from "@zxteam/contract";
import { Initable } from "@zxteam/disposable";

export interface StorageProvider extends Initable {

	/** Create data for loading price on sources */
	filterEmptyPrices(cancellationToken: CancellationToken, args: Array<price.Argument>, sources: Array<string>)
		: TaskLike<Array<price.LoadDataRequest>>;

	/** Save new price to storage provide */
	savePrices(cancellationToken: CancellationToken, newPrices: Array<price.HistoricalPrices>)
		: TaskLike<void>;

	/** Find prices */
	findPrices(cancellationToken: CancellationToken, args: Array<price.Argument>)
		: TaskLike<price.Timestamp>;

}
