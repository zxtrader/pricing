import { CancellationToken, Task as TaskLike } from "@zxteam/contract";
import { price } from "../../PriceService";

export interface SourceProvider {

	/** Loading empty price from sources */
	loadPrices(cancellationToken: CancellationToken, loadArgs: price.LoadDataRequest): TaskLike<price.HistoricalPrices>;

}
