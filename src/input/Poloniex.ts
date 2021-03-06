// import * as zxteam from "@zxteam/contract";
// import { Task } from "@zxteam/task";
// import { WebClient } from "@zxteam/webclient";
// import { ensureFactory } from "@zxteam/ensure.js";
// import RestClient from "@zxteam/restclient";
// import loggerFactory from "@zxteam/logger";

// import * as _ from "lodash";
// import * as moment from "moment";

// import { SourceProvider } from "./contract";
// import { price } from "../../PriceService";

// abstract class PoloniexRestClient extends RestClient {
// 	public constructor(baseUrl: string | URL, restClientOpts: RestClient.Opts) {
// 		super(baseUrl, restClientOpts);
// 	}
// }

// export class Poloniex extends PoloniexRestClient implements SourceProvider {
// 	public readonly sourceId = "POLONIEX";
// 	public readonly _logger: zxteam.Logger = loggerFactory.getLogger("Poloniex");

// 	public constructor(opts: RestClient.Opts) {
// 		super(new URL("https://poloniex.com/"), opts);
// 	}

// 	/**
// 	 * https://docs.poloniex.com/#returntradehistory-public
// 	 */
// 	public loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: ReadonlyArray<price.LoadDataArgs>)
// 		: zxteam.Task<Array<price.HistoricalPrices>> {
// 		return Task.run(async (ct) => {
// 			if (this._logger.isTraceEnabled) {
// 				this._logger.trace("loadPrices()... loadArgs: ", loadArgs);
// 			}

// 			const friendlyRequest: Array<price.HistoricalPrices> = [];
// 			const ensureImpl = ensureFactory((message, data) => {
// 				throw new SourceProvider.BrokenApiError("Poloniex responded non-expected data type");
// 			});

// 			try {
// 				this._logger.trace("Through all arguments");
// 				for (let i = 0; i < loadArgs.length; i++) {
// 					const argument = loadArgs[i];
// 					const ts = argument.ts;
// 					const marketCurrency = argument.marketCurrency;
// 					const tradeCurrency = argument.tradeCurrency;
// 					const friendlyTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss").unix();
// 					const args = {
// 						command: "returnTradeHistory",
// 						currencyPair: marketCurrency + "_" + tradeCurrency,
// 						start: friendlyTimeStamp.toString(),
// 						end: (friendlyTimeStamp + 120).toString(),
// 						limit: "20"
// 					};

// 					if (this._logger.isTraceEnabled) {
// 						this._logger.trace("Make request to poloniex with args: ", args);
// 					}
// 					const data = await this.invokeWebMethodGet(cancellationToken, "public", { queryArgs: args });

// 					this._logger.trace("Check cancellationToken for interrupt");
// 					ct.throwIfCancellationRequested();

// 					const body = data.bodyAsJson;

// 					this._logger.trace("Check on error");
// 					if ("error" in body) {
// 						const error = ensureImpl.string(body.error);
// 						if (error === "Invalid currency pair." || error === "Invalid start time.") {
// 							continue;
// 						}
// 						throw new SourceProvider.BrokenApiError(error);
// 					}

// 					this._logger.trace("Data validation from source");
// 					ensureImpl.array(body);

// 					this._logger.trace("Data validation is not empty");
// 					if (body.length === 0) {
// 						continue;
// 					}

// 					const lastTrade = body[body.length - 1];
// 					const marketPrice = Number(lastTrade.rate).toFixed(8);

// 					this._logger.trace("Formatting data for return");
// 					friendlyRequest.push({
// 						sourceId: this.sourceId,
// 						ts,
// 						marketCurrency,
// 						tradeCurrency,
// 						price: marketPrice
// 					});
// 				}

// 				return friendlyRequest;
// 			} catch (err) {
// 				if (err instanceof SourceProvider.BrokenApiError) {
// 					throw err; // Re-throw original error
// 				} else if (err instanceof WebClient.CommunicationError) {
// 					throw new SourceProvider.CommunicationError(err);
// 				} else {
// 					throw new SourceProvider.BrokenApiError(err.message);
// 				}
// 			}
// 		}, cancellationToken);
// 	}
// }

// export default Poloniex;

