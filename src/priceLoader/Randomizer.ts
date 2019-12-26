import * as _ from "lodash";
import { PriceApi } from "../api/PriceApi";

import * as zxteam from "@zxteam/contract";
import { PriceLoader } from "./PriceLoader";


export class Randomizer implements PriceLoader {
	public readonly sourceId = "RANDOMSOURCE";

	public async loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: ReadonlyArray<PriceApi.LoadDataArgs>)
		: Promise<Array<PriceApi.HistoricalPrices>> {
		const friendlyRequest: Array<PriceApi.HistoricalPrices> = [];

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

		return friendlyRequest;
	}
}

export default Randomizer;

