import { CancellationToken, Task as TaskLike } from "@zxteam/contract";
import { SourceProvider as SourceProviderInerface } from "./contract";
import { price } from "../../PriceService";
import { Task } from "ptask.js";

export class SourceProvider implements SourceProviderInerface {

	public loadPrices(
		cancellationToken: CancellationToken,
		loadArgs: price.LoadDataRequest
	): TaskLike<price.HistoricalPrices> {
		return Task.run(async (ct) => {
			throw new Error("Not implement yet");
		}, cancellationToken);
	}
}
