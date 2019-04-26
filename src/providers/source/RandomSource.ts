import * as _ from "lodash";
import { Task } from "ptask.js";
import { price } from "../../index";

import { CancellationToken } from "@zxteam/contract";
import {
	SourceProvider as SourceProviderInerface
} from "./contract";


export class RandomSource implements SourceProviderInerface {
	public readonly sourceId = "RANDOMSOURCE";

	public loadPrices(cancellationToken: CancellationToken, loadArgs: price.MultyLoadDataRequest): Task<Array<price.HistoricalPrices>> {
		return Task.run(async (ct) => {

			const friendlyRequest: Array<price.HistoricalPrices> = [];

			const arrayArgs = loadArgs[this.sourceId];
			for (let i = 0; i < arrayArgs.length; i++) {
				const argument = arrayArgs[i];
				const ts = argument.ts;
				const marketCurrency = argument.marketCurrency;
				const tradeCurrency = argument.tradeCurrency;
				const frPrice = Math.random() * (1000 - 0.000001) + 1000;
				friendlyRequest.push({
					sourceId: this.sourceId,
					ts,
					marketCurrency,
					tradeCurrency,
					price: frPrice
				});
			}
			return friendlyRequest as any;

		}, cancellationToken);
	}
}

export default RandomSource;

