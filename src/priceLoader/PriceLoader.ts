import * as zxteam from "@zxteam/contract";
import { HttpClient } from "@zxteam/http-client";

import { PriceApi } from "../api/PriceApi";

export interface PriceLoader {
	sourceId: string;

	/**
	 * Loading empty price from sources
	 * @param cancellationToken Cancellation Token allows your to cancel execution process
	 * @param loadArgs Arguments for which need to sync prices
	 * @error SourceProvider.CommunicationError If it failed to connect to source
	 * @error SourceProvider.BrokenApiError Something happened wrong on service
	 */
	loadPrices(
		cancellationToken: zxteam.CancellationToken,
		loadArgs: ReadonlyArray<PriceApi.LoadDataArgs>
	): Promise<Array<PriceApi.HistoricalPrices>>;
}

export namespace PriceLoader {
	export class CommunicationError extends Error {
		public readonly innerError: HttpClient.CommunicationError;

		public constructor(innerError: HttpClient.CommunicationError) {
			super(innerError.message);
			this.innerError = innerError;
		}
	}
	export class BrokenApiError extends Error { }
}
