import { CancellationToken, Task as TaskLike } from "@zxteam/contract";
import { price } from "../../PriceService";

export interface SourceProvider {
	sourcesytemId: string;

	/**
	 * Loading empty price from sources
	 * @param cancellationToken Cancellation Token allows your to cancel execution process
	 * @param loadArgs Arguments for which need to sync prices
	 * @error LimitError If breaking a request rate limit to source
	 * @error BrokenProviderError If source provide returm wrong data
	 * @error NoRecordError If don't exist data for arguments
	 * @error ConnectionError If it failed to connect to source
	 * @error BrokenApiError Something happened wrong on service
	 */
	loadPrices(cancellationToken: CancellationToken, loadArgs: price.LoadDataRequest): TaskLike<price.HistoricalPrices>;

}

export class NoRecordError extends Error { }
export class BrokenProviderError extends Error { }
export class ConnectionError extends Error { }
export class BrokenApiError extends Error { }
