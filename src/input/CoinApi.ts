import { CancellationToken, Logger } from "@zxteam/contract";
import { WebClient } from "@zxteam/web-client";
import { Configuration, PriceApi } from "..";
import { PriceLoader } from "./PriceLoader";
import loggerFactory from "@zxteam/logger";
import ensureFactory from "@zxteam/ensure";
import HttpClient from "@zxteam/http-client";
import moment = require("moment");
import _ = require("lodash");


abstract class CoinApiRestClient extends WebClient {
	public constructor(baseUrl: string | URL, restClientOpts: WebClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class CoinApi extends CoinApiRestClient implements PriceLoader {
	public readonly sourceId: string = "COINAPI";
	public readonly _log: Logger = loggerFactory.getLogger("CoinApi");
	private readonly _apiKey: string;
	public constructor(opts: WebClient.Opts, apiKey: string) {
		super(new URL("https://rest.coinapi.io/"), opts);
		this._apiKey = apiKey;
	}

	public async loadPrices(
		cancellationToken: CancellationToken,
		loadArgs: readonly PriceApi.LoadDataBase[]
	): Promise<PriceApi.HistoricalPrices[]> {
		if (this._log.isTraceEnabled) {
			this._log.trace("CointApi loadPrices()... loadArgs: ", loadArgs);
		}

		const friendlyRequest: Array<PriceApi.HistoricalPrices> = [];
		const ensureImpl = ensureFactory((message, data) => {
			throw new PriceLoader.BrokenApiError("CoinApi responded non-expected data type");
		});
		for (const loadArg of loadArgs) {
			try {
				const { tradeCurrency, marketCurrency, ts } = loadArg;
				const path = `v1/exchangerate/${tradeCurrency}/${marketCurrency}`;
				const momentTimeNow = moment.utc();
				const momentStart = moment.utc("1970-01-01");
				const momentTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss");
				const friendlyTimeStamp = momentTimeStamp.format("YYYYMMDDTHHmmss").toString();

				if (momentTimeNow.isBefore(momentTimeStamp) || momentStart.isAfter(momentTimeStamp)) {
					continue;
				}

				const args = {
					time: friendlyTimeStamp
				};
				const headers = {
					'X-CoinAPI-Key': this._apiKey
				}

				const data = await this.get(cancellationToken, path, { queryArgs: args, headers });
				const body = data.bodyAsJson;
				this._log.trace("Check on error limit request");

				const resopnseMarketCurrency: string = ensureImpl.string(body["asset_id_quote"]);
				const resopnseTradeCurrency: string = ensureImpl.string(body["asset_id_base"]);
				const resopnseRate: number = ensureImpl.number(body["rate"]);
				const resopnseTime: string = ensureImpl.string(body["time"]);
				// const momentTimestamp = moment.
				if (resopnseRate === 0) {
					continue;
				}
				const friendlyPrice: string = resopnseRate.toFixed(8);
				
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
