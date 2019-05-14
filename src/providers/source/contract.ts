import * as zxteam from "@zxteam/contract";

import { price } from "../../PriceService";
import WebClient from "@zxteam/webclient";

export interface SourceProvider {
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
		loadArgs: ReadonlyArray<price.LoadDataArgs>
	): zxteam.Task<Array<price.HistoricalPrices>>;
}

export namespace SourceProvider {
	export class CommunicationError extends Error {
		public readonly innerError: WebClient.CommunicationError;

		public constructor(innerError: WebClient.CommunicationError) {
			super(innerError.message);
			this.innerError = innerError;
		}
	}
	export class BrokenApiError extends Error { }
}
