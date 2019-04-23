import { price } from "../../PriceService";
import { CancellationToken, Task as TaskLike } from "@zxteam/contract";

export interface SourceProvider {
	sourcesytemId: string;

	/**
	 * Loading empty price from sources
	 * @param cancellationToken Cancellation Token allows your to cancel execution process
	 * @param loadArgs Arguments for which need to sync prices
	 * @error NoDataError If don't exist data for arguments
	 * @error CommunicationError If it failed to connect to source
	 * @error BrokenApiError Something happened wrong on service
	 */
	loadPrices(cancellationToken: CancellationToken, loadArgs: price.LoadDataRequest): TaskLike<price.HistoricalPrices>;
}

export class NoDataError extends Error { }
export class CommunicationError extends Error { }
export class BrokenApiError extends Error { }
