import * as _ from "lodash";
import * as moment from "moment";
import { Task } from "ptask.js";
import { price } from "../../PriceService";
import { WebClient } from "@zxteam/webclient";
import { ensureFactory } from "@zxteam/ensure.js";

import { CancellationToken } from "@zxteam/contract";
import RestClient from "@zxteam/restclient";
import {
	SourceProvider as SourceProviderInerface,
	NoDataError,
	BrokenApiError,
	CommunicationError
} from "./contract";


export abstract class CryptoCompareRestClient extends RestClient {
	public constructor(baseUrl: string | URL, restClientOpts: RestClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class CryptoCompare extends CryptoCompareRestClient implements SourceProviderInerface {
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

			let bodyTimeStampPrices = {};
			const ensureImpl = ensureFactory((message, data) => {
				throw new CommunicationError("CryptoCompare responded non-expected data type");
			});

			try {
				const timeStampObject = loadArgs[this.sourcesytemId];
				const timestampKeys = Object.keys(timeStampObject);
				for (let i = 0; i < timestampKeys.length; i++) {
					const timestamp = Number(timestampKeys[i]);
					const tradeCurrencyObject = timeStampObject[timestamp];
					const tradeCurrencys = Object.keys(tradeCurrencyObject);
					let bodyTradePrices = {};

					for (let x = 0; x < tradeCurrencys.length; x++) {
						const tradeCurrency = tradeCurrencys[x];
						const marketCurrency = Object.keys(tradeCurrencyObject[tradeCurrency]);
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
							throw new CommunicationError(body.Data.Message);
						}

						ensureImpl.object(body[tradeCurrency]);
						const fsymData = body[tradeCurrency];
						Object.keys(fsymData).forEach(tsym => {
							ensureImpl.string(tsym);
							ensureImpl.number(fsymData[tsym]);
						});

						const friendlyTimeStampObject = body;
						bodyTradePrices = Object.assign(bodyTradePrices, friendlyTimeStampObject);
					}
					bodyTimeStampPrices = Object.assign(bodyTimeStampPrices, { [timestamp]: bodyTradePrices });
				}
			} catch (err) {
				if (err instanceof WebClient.CommunicationError || err instanceof CommunicationError) {
					throw new CommunicationError(err.message);
				} else {
					throw new BrokenApiError(err.message);
				}
			}

			const friendlyRequest: price.HistoricalPrices = { [this.sourcesytemId]: bodyTimeStampPrices };
			return friendlyRequest;

		}, cancellationToken);
	}
}

export default CryptoCompare;

