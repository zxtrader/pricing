import * as _ from "lodash";
import * as moment from "moment";
import { Task } from "@zxteam/task";
import { price } from "../../index";
import { WebClient } from "@zxteam/webclient";
import { ensureFactory } from "@zxteam/ensure.js";
import * as zxteam from "@zxteam/contract";
import RestClient from "@zxteam/restclient";
import {
	SourceProvider as SourceProviderInerface,
	BrokenApiError,
	CommunicationError
} from "./contract";
import loggerFactory from "@zxteam/logger";


abstract class CryptocompareRestClient extends RestClient {
	public constructor(baseUrl: string | URL, restClientOpts: RestClient.Opts) {
		super(baseUrl, restClientOpts);
	}
}

export class Cryptocompare extends CryptocompareRestClient implements SourceProviderInerface {
	public readonly sourceId = "CRYPTOCOMPARE";
	public readonly _logger: zxteam.Logger = loggerFactory.getLogger("Cryptocompare");

	public constructor(url: string | URL, opts: RestClient.Opts) {
		super(url, opts);
	}

	/**
	 * fsym - это tradeCurrency
	 * https://min-api.cryptocompare.com/data/pricehistorical?fsym=ETH&tsyms=BTC,USD,EUR&ts=1452680400&extraParams=your_app_name
	 */
	public loadPrices(cancellationToken: zxteam.CancellationToken, loadArgs: price.MultyLoadDataRequest): Task<Array<price.HistoricalPrices>> {
		return Task.run(async (ct) => {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("loadPrices()... loadArgs: ", loadArgs);
			}

			const friendlyRequest: Array<price.HistoricalPrices> = [];
			const ensureImpl = ensureFactory((message, data) => {
				throw new CommunicationError("CryptoCompare responded non-expected data type");
			});

			try {
				const arrayArgs = loadArgs[this.sourceId];

				this._logger.trace("Through all arguments");
				for (let i = 0; i < arrayArgs.length; i++) {
					const argument = arrayArgs[i];
					const ts = argument.ts;
					const marketCurrency = argument.marketCurrency;
					const tradeCurrency = argument.tradeCurrency;
					const friendlyTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss").unix().toString();

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
						throw new CommunicationError(body.Data.Message);
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
				if (err instanceof WebClient.CommunicationError || err instanceof CommunicationError) {
					throw new CommunicationError(err.message);
				} else {
					throw new BrokenApiError(err.message);
				}
			}
		}, cancellationToken);
	}
}

export default Cryptocompare;

