import { CancellationToken, Task as TaskLike, Logger } from "@zxteam/contract";
import { SourceProvider as SourceProviderInerface, SourceProvider } from "./contract";
import { price } from "../../PriceService";
import { Task } from "ptask.js";
import { Disposable } from "@zxnode/base";

export class ManagerSourceProvider extends Disposable implements SourceProviderInerface {
	public readonly sourcesytemId = "MANAGER";
	private readonly _sources: Array<SourceProvider>;
	private readonly _logger: Logger;

	constructor(sources: Array<SourceProvider>, logger: Logger) {
		super();
		this._sources = sources;
		this._logger = logger;
	}

	public loadPrices(
		cancellationToken: CancellationToken,
		loadArgs: price.LoadDataRequest
	): TaskLike<price.HistoricalPrices> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("loadPrices()... args: ", loadArgs);
			}

			this._logger.trace("Declaration friendly request");
			let friendlyPrices: price.HistoricalPrices = {};

			this._logger.trace("Create array sourcesystem id which need syncs price");
			const sources = Object.keys(loadArgs);

			for (let i = 0; i < sources.length; i++) {
				if (this._logger.isTraceEnabled) {
					this._logger.trace(`Set sourcesystem id: ${sources[i]}`);
				}
				const sourcesytemId = sources[i];

				this._logger.trace("Get source provider object for get price");
				const source = helpers.getSource(this._sources, sourcesytemId);

				if (source) {
					this._logger.trace("Loading new price from source");
					const sourcePrice = await source.loadPrices(ct, { sourcesytemId: loadArgs[sourcesytemId] });

					this._logger.trace("Combine the results");
					friendlyPrices = Object.assign(friendlyPrices, sourcePrice);
				}
			}

			if (this._logger.isTraceEnabled) {
				this._logger.trace(`return result: ${friendlyPrices}`);
			}
			return friendlyPrices;
		}, cancellationToken);
	}
	protected disposing(): void | Promise<void> {
		throw new Error("Method not implemented.");
	}

}

export namespace helpers {
	export function getSource(sources: Array<SourceProvider>, sourcesytemId: string): SourceProvider | null {
		for (let n = 0; n < sources.length; n++) {
			const source = sources[n];
			if (source.sourcesytemId === sourcesytemId) {
				return source;
			}
		}
		// if don't exist source return null
		return null;
	}
}
