import * as _ from "lodash";
import * as moment from "moment";

import { Task } from "ptask.js";
import { LimitError } from "limit.js";
import { price } from "../../PriceService";
import { WebClient } from "@zxteam/webclient";
import { RestClient } from "@zxteam/restclient";
import { CancellationToken } from "@zxteam/contract";
import {
	SourceProvider as SourceProviderInerface,
	NoRecordError,
	BrokenApiError,
	ConnectionError,
	BrokenProviderError
} from "./contract";

export class CryptoCompare extends RestClient implements SourceProviderInerface {
	public readonly sourcesytemId = "CRYPTOCOMPARE";
	public constructor() {
		super("https://min-api.cryptocompare.com/data/", {
			limit: {
				instance: {
					parallel: 5,
					perSecond: 15,
					perMinute: 300,
					perHour: 8000
				},
				timeout: 1000
			},
			webClient: {
				timeout: 750
			}
		});
	}

	/**
	 * fsym - это tradeCurrency (в терминах zxtrader)
	 * https://min-api.cryptocompare.com/data/pricehistorical?fsym=ETH&tsyms=BTC,USD,EUR&ts=1452680400&extraParams=your_app_name
	 */
	public loadPrices(cancellationToken: CancellationToken, loadArgs: price.LoadDataRequest): Task<price.HistoricalPrices> {
		return Task.run(async (ct) => {
			let friendlyTsPrices = {};
			try {
				const timeStampObject = loadArgs[this.sourcesytemId];
				const timestampKeys = Object.keys(timeStampObject);
				for (let i = 0; i < timestampKeys.length; i++) {
					const timestamp = Number(timestampKeys[i]);

					const tradeCurrencyObject = timeStampObject[timestamp];
					const tradeCurrency = Object.keys(tradeCurrencyObject)[0];
					const marketCurrency = tradeCurrencyObject[tradeCurrency];

					const friendlyTimeStamp = moment.utc(timestamp, "YYYYMMDDHHmmss").unix().toString();
					const args = {
						fsym: tradeCurrency,
						tsyms: marketCurrency.join(","),
						ts: friendlyTimeStamp
					};

					const data = await this.invokeWebMethodGet(cancellationToken, "pricehistorical", { queryArgs: args });

					const body = data.bodyAsJson;
					if (
						"Data" in body &&
						"RateLimit" in body &&
						_.isObject(body.Data) &&
						_.isObject(body.RateLimit) &&
						_.isString(body.Data.Message) &&
						_.isString(body.Data.Response) &&
						body.Data.Response === "Error"
					) {
						throw new LimitError(body.Data.Message);
					}
					if (!(tradeCurrency in body && _.isObject(body[tradeCurrency]))) {
						throw new BrokenProviderError(`Unexpected fsym key/data ${body}`);
					}
					const fsymData = body[tradeCurrency];
					Object.keys(fsymData).forEach(tsym => {
						if (!_.isString(tsym)) {
							throw new BrokenProviderError(`Unexpected tsym key ${fsymData}`);
						}
						const tsymData = fsymData[tsym];
						if (!_.isNumber(tsymData)) {
							throw new BrokenProviderError(`Unexpected tsym value ${fsymData}`);
						}
					});
					const friendlyTimeStampObject = { [timestamp]: body };
					friendlyTsPrices = Object.assign(friendlyTsPrices, friendlyTimeStampObject);
				}
			} catch (err) {
				const message = `NameError: ${err.name}, message: ${err.message}`;
				if (err instanceof WebClient.CommunicationError) {
					throw new ConnectionError(message);
				} else if (err instanceof NoRecordError) {
					throw new NoRecordError(message);
				} else {
					throw new BrokenApiError(message);
				}
			}

			const friendlyRequest: price.HistoricalPrices = { [this.sourcesytemId]: friendlyTsPrices };
			return friendlyRequest;
		}, cancellationToken);
	}
}

export default CryptoCompare;
