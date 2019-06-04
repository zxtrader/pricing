import * as zxteam from "@zxteam/contract";
import { ensureFactory } from "@zxteam/ensure.js";
import loggerFactory from "@zxteam/logger";
import RestClient from "@zxteam/restclient";
import { Task } from "@zxteam/task";
import { WebClient } from "@zxteam/webclient";

import * as _ from "lodash";
import * as moment from "moment";

import { SourceProvider } from "./contract";
import { price } from "../../PriceService";

abstract class CryptocompareRestClient extends RestClient {
	public constructor(baseUrl: string | URL, restClientOpts: RestClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class Cryptocompare extends CryptocompareRestClient implements SourceProvider {
	public readonly sourceId = "CRYPTOCOMPARE";
	public readonly _logger: zxteam.Logger = loggerFactory.getLogger("Cryptocompare");

	public constructor(opts: RestClient.Opts) {
		super(new URL("https://min-api.cryptocompare.com/data/"), opts);
	}

	/**
	 * fsym - это tradeCurrency
	 * https://min-api.cryptocompare.com/data/pricehistorical?fsym=ETH&tsyms=BTC,USD,EUR&ts=1452680400&extraParams=your_app_name
	 */
	public loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: ReadonlyArray<price.LoadDataArgs>)
		: zxteam.Task<Array<price.HistoricalPrices>> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("loadPrices()... loadArgs: ", loadArgs);
			}

			const friendlyRequest: Array<price.HistoricalPrices> = [];
			const ensureImpl = ensureFactory((message, data) => {
				throw new SourceProvider.BrokenApiError("CryptoCompare responded non-expected data type");
			});

			try {
				this._logger.trace("Through all arguments");
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

					if (this._logger.isTraceEnabled) {
						this._logger.trace("Make request to cryptocompare with args: ", args);
					}
					const data = await this.invokeWebMethodGet(cancellationToken, "pricehistorical", { queryArgs: args });

					this._logger.trace("Check cancellationToken for interrupt");
					ct.throwIfCancellationRequested();

					const body = data.bodyAsJson;

					this._logger.trace("Check on error limit request");
					if (
						"Data" in body &&
						"RateLimit" in body &&
						_.isObject(body.Data) &&
						_.isObject(body.RateLimit) &&
						_.isString(body.Data.Message) &&
						_.isString(body.Data.Response) &&
						body.Data.Response === "Error"
					) {
						throw new SourceProvider.BrokenApiError(body.Data.Message);
					}

					if ("Response" in body && body.Response === "Error") {
						if ("Message" in body && body.Message.startsWith("There is no data for")) {
							continue;
						}
						throw new SourceProvider.BrokenApiError(body.Message);
					}

					this._logger.trace("Data validation from source");
					ensureImpl.object(body[tradeCurrency]);
					const fsymData = body[tradeCurrency];
					Object.keys(fsymData).forEach(tsym => {
						ensureImpl.string(tsym);
						ensureImpl.number(fsymData[tsym]);
					});

					this._logger.trace("Formatting data for return");
					const frTradeCurrency = Object.keys(body)[0];
					const frMarketCurrency = Object.keys(body[tradeCurrency])[0];
					const frPrice = body[tradeCurrency][marketCurrency];
					if (frPrice === 0) {
						continue;
					}
					friendlyRequest.push({
						sourceId: this.sourceId,
						ts,
						marketCurrency: frMarketCurrency,
						tradeCurrency: frTradeCurrency,
						price: frPrice
					});

				}

				return friendlyRequest;
			} catch (err) {
				if (err instanceof SourceProvider.BrokenApiError) {
					throw err;
				} else if (err instanceof WebClient.CommunicationError) {
					throw new SourceProvider.CommunicationError(err);
				} else {
					throw new SourceProvider.BrokenApiError(err.message);
				}
			}
		}, cancellationToken);
	}
}

export default Cryptocompare;

