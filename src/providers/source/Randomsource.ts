import * as _ from "lodash";
import { Task } from "@zxteam/task";
import { price } from "../../PriceService";

import * as zxteam from "@zxteam/contract";
import {
	SourceProvider as SourceProviderInerface
} from "./contract";


export class Randomsource implements SourceProviderInerface {
	public readonly sourceId = "RANDOMSOURCE";

	public loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: ReadonlyArray<price.LoadDataArgs>)
		: zxteam.Task<Array<price.HistoricalPrices>> {
		return Task.run(async (ct) => {
			const friendlyRequest: Array<price.HistoricalPrices> = [];

			for (let i = 0; i < loadArgs.length; i++) {
				const argument = loadArgs[i];
				const ts = argument.ts;
				const marketCurrency = argument.marketCurrency;
				const tradeCurrency = argument.tradeCurrency;
				const frPrice = (Math.random() * (1000 - 0.000001) + 1000).toFixed(8);
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

export default Randomsource;

