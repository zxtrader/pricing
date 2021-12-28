import { CancellationToken, Logger } from "@zxteam/contract";
import { WebClient } from "@zxteam/web-client";
import { Configuration, PriceApi } from "..";
import { PriceLoader } from "./PriceLoader";
import loggerFactory from "@zxteam/logger";
import ensureFactory from "@zxteam/ensure";
import HttpClient from "@zxteam/http-client";
import moment = require("moment");
import _ = require("lodash");


abstract class YahooFinanceRestClient extends WebClient {
	public constructor(baseUrl: string | URL, restClientOpts: WebClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class YahooFinance extends YahooFinanceRestClient implements PriceLoader {
	public readonly sourceId: string = "YAHOOFINANCE";
	public readonly _log: Logger = loggerFactory.getLogger("YahooFinance");
	private readonly _apiKey: string;
	public constructor(opts: WebClient.Opts, apiKey: string) {
		super(new URL("https://yfapi.net/"), opts);
		this._apiKey = apiKey;
	}

	public async loadPrices(
		cancellationToken: CancellationToken,
		loadArgs: readonly PriceApi.LoadDataBase[]
	): Promise<PriceApi.HistoricalPrices[]> {
		if (this._log.isTraceEnabled) {
			this._log.trace("YahooFinance loadPrices()... loadArgs: ", loadArgs);
		}

		const friendlyRequest: Array<PriceApi.HistoricalPrices> = [];
		const ensureImpl = ensureFactory((message, data) => {
			throw new PriceLoader.BrokenApiError("YahooFinance responded non-expected data type");
		});
		for (const loadArg of loadArgs) {
			try {
				const { tradeCurrency, marketCurrency, ts } = loadArg;
				const symbol: string = `${tradeCurrency}-${marketCurrency}`;
				const path = `v7/finance/options/${symbol}`;
				const momentTimeNow = moment.utc();
				const momentStart = moment.utc("1970-01-01");
				const momentTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss");
				const friendlyTimeStamp = momentTimeStamp.unix().toString();

				if (momentTimeNow.isBefore(momentTimeStamp) || momentStart.isAfter(momentTimeStamp)) {
					continue;
				}

				const args = {
					date: friendlyTimeStamp
				};
				const headers = {
					'x-api-key': this._apiKey
				}

				const data = await this.get(cancellationToken, path, { queryArgs: args, headers });
				const body = data.bodyAsJson;
				this._log.trace("Check on error limit request");
				if (
					"optionChain" in body &&
					_.isObject(body.optionChain)
					&& body.optionChain.error
				) {
					throw new PriceLoader.BrokenApiError(body.optionChain.error);
				}

				const optionChain = ensureImpl.object(body["optionChain"]);
				const [result] = ensureImpl.array(optionChain["result"]);
				const quote = ensureImpl.object(result["quote"]);
				const resopnseMarketCurrency = ensureImpl.string(quote["currency"]);
				const resopnseTradeCurrency = ensureImpl.string(quote["fromCurrency"]);
				const resopnseRegularMarketPrice: number = ensureImpl.number(quote["regularMarketPrice"]);
				if (resopnseRegularMarketPrice === 0) {
					continue;
				}
				const friendlyPrice: string = resopnseRegularMarketPrice.toFixed(8);
				
				friendlyRequest.push({
					sourceId: this.sourceId,
					ts,
					marketCurrency: resopnseMarketCurrency,
					tradeCurrency: resopnseTradeCurrency,
					price: friendlyPrice
				});

			} catch (err) {
				if (err instanceof PriceLoader.BrokenApiError) {
					throw err;
				} else if (err instanceof HttpClient.CommunicationError) {
					throw new PriceLoader.CommunicationError(err);
				} else {
					throw new PriceLoader.BrokenApiError(err.message);
				}
			}
		}


		return friendlyRequest;
	}
}
