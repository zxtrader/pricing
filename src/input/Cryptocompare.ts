import * as zxteam from "@zxteam/contract";
import { ensureFactory } from "@zxteam/ensure";
import loggerFactory from "@zxteam/logger";
import { WebClient } from "@zxteam/web-client";
import { HttpClient } from "@zxteam/http-client";

import * as _ from "lodash";
import * as moment from "moment";
import * as http from "http";

import { PriceLoader } from "./PriceLoader";
import { PriceApi } from "../api/PriceApi";

abstract class CryptocompareRestClient extends WebClient {
	public constructor(baseUrl: string | URL, restClientOpts: WebClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class Cryptocompare extends CryptocompareRestClient implements PriceLoader {
	public readonly sourceId = "CRYPTOCOMPARE";
	public readonly _log: zxteam.Logger = loggerFactory.getLogger("Cryptocompare");
	private readonly _apiKey: string;

	public constructor(opts: WebClient.Opts, apiKey: string) {
		super(new URL("https://min-api.cryptocompare.com/data/"), opts);
		this._apiKey = apiKey;
	}

	/**
	 * fsym - это tradeCurrency
	 * https://min-api.cryptocompare.com/data/pricehistorical?fsym=ETH&tsyms=BTC,USD,EUR&ts=1452680400&extraParams=your_app_name
	 */
	public async loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: ReadonlyArray<PriceApi.LoadDataArgs>)
		: Promise<Array<PriceApi.HistoricalPrices>> {
		if (this._log.isTraceEnabled) {
			this._log.trace("loadPrices()... loadArgs: ", loadArgs);
		}

		const friendlyRequest: Array<PriceApi.HistoricalPrices> = [];
		const ensureImpl = ensureFactory((message, data) => {
			throw new PriceLoader.BrokenApiError("CryptoCompare responded non-expected data type");
		});

		try {
			this._log.trace("Through all arguments");
			for (let i = 0; i < loadArgs.length; i++) {
				const argument = loadArgs[i];
				const ts = argument.ts;
				const marketCurrency = argument.marketCurrency;
				const tradeCurrency = argument.tradeCurrency;

				const momentTimeNow = moment.utc();
				const momentStart = moment.utc("1970-01-01");
				const momentTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss");

				if (momentTimeNow.isBefore(momentTimeStamp) || momentStart.isAfter(momentTimeStamp)) {
					continue;
				}

				const friendlyTimeStamp = momentTimeStamp.unix().toString();

				const args = {
					fsym: tradeCurrency,
					tsyms: marketCurrency,
					ts: friendlyTimeStamp
				};

				const headers: http.OutgoingHttpHeaders = {};
				headers["authorization"] = `Apikey ${this._apiKey}`;

				this._log.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();


				this._log.trace("Make request to cryptocompare with args: ", args);
				const data = await this.get(cancellationToken, "pricehistorical", { queryArgs: args, headers });

				const body = data.bodyAsJson;

				this._log.trace("Check on error limit request");
				if (
					"Data" in body &&
					"RateLimit" in body &&
					_.isObject(body.Data) &&
					_.isObject(body.RateLimit) &&
					_.isString(body.Data.Message) &&
					_.isString(body.Data.Response) &&
					body.Data.Response === "Error"
				) {
					throw new PriceLoader.BrokenApiError(body.Data.Message);
				}

				if ("Response" in body && body.Response === "Error") {
					if ("Message" in body && body.Message.startsWith("There is no data for")) {
						continue;
					}
					throw new PriceLoader.BrokenApiError(body.Message);
				}

				this._log.trace("Data validation from source");
				ensureImpl.object(body[tradeCurrency]);
				const fsymData = body[tradeCurrency];
				Object.keys(fsymData).forEach(tsym => {
					ensureImpl.string(tsym);
					ensureImpl.number(fsymData[tsym]);
				});

				this._log.trace("Formatting data for return");
				const frTradeCurrency = Object.keys(body)[0];
				const frMarketCurrency = Object.keys(body[tradeCurrency])[0];
				const frPrice: number = body[tradeCurrency][marketCurrency];
				if (frPrice === 0) {
					continue;
				}
				const friendlyPrice: string = frPrice.toFixed(8);
				friendlyRequest.push({
					sourceId: this.sourceId,
					ts,
					marketCurrency: frMarketCurrency,
					tradeCurrency: frTradeCurrency,
					price: friendlyPrice
				});

			}

			return friendlyRequest;
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
}

export default Cryptocompare;

