import * as _ from "lodash";
import * as moment from "moment";
import { Task } from "@zxteam/task";
import { price } from "../../PriceService";
import { WebClient } from "@zxteam/webclient";
import { ensureFactory } from "@zxteam/ensure.js";
import * as zxteam from "@zxteam/contract";
import RestClient from "@zxteam/restclient";
import { SourceProvider } from "./contract";
import loggerFactory from "@zxteam/logger";


abstract class BinanceRestClient extends RestClient {
	public constructor(baseUrl: string | URL, restClientOpts: RestClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class Binance extends BinanceRestClient implements SourceProvider {
	public readonly sourceId = "BINANCE";
	public readonly _logger: zxteam.Logger = loggerFactory.getLogger("Binance");

	public constructor(url: string | URL, opts: RestClient.Opts) {
		super(url, opts);
	}

	/**
	 * https://github.com/binance-exchange/binance-official-api-docs/blob/master/rest-api.md
	 */
	public loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: ReadonlyArray<price.LoadDataArgs>)
		: zxteam.Task<Array<price.HistoricalPrices>> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("loadPrices()... loadArgs: ", loadArgs);
			}

			const friendlyRequest: Array<price.HistoricalPrices> = [];
			const ensureImpl = ensureFactory((message, data) => {
				throw new SourceProvider.BrokenApiError("Binance responded non-expected data type");
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

					const friendlyTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss").unix();
					const args = {
						symbol: tradeCurrency + marketCurrency,
						startTime: (friendlyTimeStamp * 1000).toString(),
						endTime: ((friendlyTimeStamp * 1000) + 12000).toString()
					};

					if (this._logger.isTraceEnabled) {
						this._logger.trace("Make request to binance with args: ", args);
					}
					const data = await this.invokeWebMethodGet(cancellationToken, "api/v1/aggTrades", { queryArgs: args });

					this._logger.trace("Check cancellationToken for interrupt");
					ct.throwIfCancellationRequested();

					const body = data.bodyAsJson;

					this._logger.trace("Check on error");
					// if ("error" in body) {
					// 	const error = ensureImpl.string(body.error);
					// 	if (error === "Invalid currency pair." || error === "Invalid start time.") {
					// 		continue;
					// 	}
					// 	throw new CommunicationError(error);
					// }

					this._logger.trace("Data validation from source");
					ensureImpl.array(body);

					this._logger.trace("Data validation is not empty");
					if (body.length === 0) {
						continue;
					}

					const lastTrade = body[0];
					const marketPrice = Number(lastTrade.p);

					this._logger.trace("Formatting data for return");
					friendlyRequest.push({
						sourceId: this.sourceId,
						ts,
						marketCurrency,
						tradeCurrency,
						price: marketPrice
					});
				}

				return friendlyRequest;
			} catch (err) {
				if (err instanceof WebClient.WebError) {
					// if bad request need return empty array but, this source dont have req market
					return [];
				} else if (err instanceof SourceProvider.BrokenApiError) {
					throw err; // re-throw original error
				} else if (err instanceof WebClient.CommunicationError) {
					throw new SourceProvider.CommunicationError(err);
				} else {
					throw new SourceProvider.BrokenApiError(err.message);
				}
			}
		}, cancellationToken);
	}
}

export default Binance;

