import { CancellationToken, Task as TaskLike, Logger } from "@zxteam/contract";
import { StorageProvider as StorageProviderInerface } from "./contract";
import { price } from "../../PriceService";
import { Task } from "ptask.js";
import { Disposable } from "@zxnode/base";

export class StorageProvider extends Disposable implements StorageProviderInerface {

	private readonly _logger: Logger;
	private readonly _url: URL;

	constructor(url: URL, logger: Logger) {
		super();
		this._url = url;
		this._logger = logger;
	}

	public loadEmptyPrices(cancellationToken: CancellationToken, args: Array<price.Argument>): TaskLike<price.LoadDataRequest> {
		return Task.run(async (ct) => {
			throw new Error("Not implement yet");
		}, cancellationToken);
	}

	public savePrices(cancellationToken: CancellationToken, newPrices: price.HistoricalPrices): TaskLike<void> {
		return Task.run(async (ct) => {
			throw new Error("Not implement yet");
		}, cancellationToken);
	}

	public findPrices(cancellationToken: CancellationToken, args: Array<price.Argument>): TaskLike<Array<price.Prices>> {
		return Task.run(async (ct) => {
			throw new Error("Not implement yet");
		}, cancellationToken);
	}

	protected disposing(): void | Promise<void> {
		throw new Error("Method not implemented.");
	}
}
