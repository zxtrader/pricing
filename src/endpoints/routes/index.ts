// import * as express from "express";
// import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
// import loggerFactory from "@zxteam/logger";
// import { PriceService, price, InvalidDateError, ArgumentException } from "../../PriceService";

// export default function (priceService: PriceService, route?: express.Router) {
// 	const expressRouter: express.Router = (route) ? route : express.Router();
// 	const log = loggerFactory.getLogger("HttpEndpoint v1");

// 	expressRouter.get("/price/:args", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
// 		try {
// 			if (log.isTraceEnabled) { log.trace(`Price request ${req.url}`); }
// 			const args = priceRuntime.parseArgs(req.params.args);
// 			if (log.isTraceEnabled) { log.trace(`Args: ${JSON.stringify(args)}`); }
// 			const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;
// 			return res.status(200).end(priceRuntime.render(prices));
// 		} catch (e) {
// 			if (e instanceof ArgumentException) {
// 				if (log.isTraceEnabled) { log.trace(`Bad request`, e); }
// 				if (log.isInfoEnabled) { log.trace(`Bad request`); }
// 				return res.status(400).end("Bad request");
// 			}
// 			if (e instanceof InvalidDateError) {
// 				if (log.isTraceEnabled) { log.trace(`Invalid format date`, e); }
// 				if (log.isInfoEnabled) { log.trace(`Invalid format date`); }
// 				return res.status(400).end("Invalid format date");
// 			}
// 			if (log.isTraceEnabled) { log.trace(`Unhandled error`, e); }
// 			if (log.isWarnEnabled) { log.warn(`Unhandled error ${e.message}`); }
// 			next(e);
// 		}
// 	});

// 	expressRouter.get("/rate/single/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
// 		try {
// 			if (log.isTraceEnabled) { log.trace(`Rate single request ${req.url}`); }
// 			const arg = priceRuntime.parseSingleParams(req.query);
// 			const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, [arg]).promise;
// 			return res.status(200).end(priceRuntime.renderForSingle(prices, arg));
// 		} catch (e) {
// 			if (e instanceof ArgumentException) {
// 				if (log.isTraceEnabled) { log.trace(`Bad request`, e); }
// 				if (log.isInfoEnabled) { log.trace(`Bad request`); }
// 				return res.status(400).end("Bad request");
// 			}
// 			if (e instanceof InvalidDateError) {
// 				if (log.isTraceEnabled) { log.trace(`Invalid format date`, e); }
// 				if (log.isInfoEnabled) { log.trace(`Invalid format date`); }
// 				return res.status(400).end("Invalid format date");
// 			}
// 			if (log.isTraceEnabled) { log.trace(`Unhandled error`, e); }
// 			if (log.isWarnEnabled) { log.warn(`Unhandled error ${e.message}`); }
// 			next(e);
// 		}
// 	});

// 	expressRouter.get("/rate/batch/", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
// 		try {
// 			if (log.isTraceEnabled) { log.trace(`Rate batch request ${req.url}`); }
// 			const args = priceRuntime.parseBatchArgs(req.query.items);
// 			const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;
// 			return res.status(200).end(priceRuntime.renderForBatch(prices, args));
// 		} catch (e) {
// 			if (e instanceof ArgumentException) {
// 				if (log.isTraceEnabled) { log.trace(`Bad request`, e); }
// 				if (log.isInfoEnabled) { log.trace(`Bad request`); }
// 				return res.status(400).end("Bad request");
// 			}
// 			if (e instanceof InvalidDateError) {
// 				if (log.isTraceEnabled) { log.trace(`Invalid format date`, e); }
// 				if (log.isInfoEnabled) { log.trace(`Invalid format date`); }
// 				return res.status(400).end("Invalid format date");
// 			}
// 			if (log.isTraceEnabled) { log.trace(`Unhandled error`, e); }
// 			if (log.isWarnEnabled) { log.warn(`Unhandled error ${e.message}`); }
// 			next(e);
// 		}
// 	});

// 	expressRouter.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
// 		if (err) {
// 			log.error(err);
// 		}
// 		return res.status(400).end("400 Bad Request. See server's log for details.");
// 	});

// 	return expressRouter;
// }

// namespace priceRuntime {
// 	export function parseArgs(args: string): Array<price.Argument> {
// 		const argsRegex = /^[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?(,[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?)*$/;
// 		if (!args) { throw new ArgumentException("args"); }
// 		if (!argsRegex.test(args)) {
// 			throw new ArgumentException("args");
// 		}
// 		const argTokens = args.split(",");
// 		const result: Array<price.Argument> = [];
// 		argTokens.forEach(argToken => {
// 			const parts = argToken.split(":");
// 			const ts: number = parseInt(parts[0]);
// 			const marketCurrency: string = parts[1];
// 			const tradeCurrency: string = parts[2];
// 			const sourceId: string | undefined = parts.length === 4 && parts[3] || undefined;
// 			const requiredAllSourceIds = !sourceId && parts.length === 4;

// 			result.push({ ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds });
// 		});
// 		return result;
// 	}

// 	export function parseSingleParams(params: any): price.Argument {
// 		const { exchange, date, market, trade } = params;
// 		if (exchange && date && market && trade) {
// 			return {
// 				sourceId: exchange,
// 				ts: +date,
// 				marketCurrency: market,
// 				tradeCurrency: trade,
// 				requiredAllSourceIds: false
// 			};
// 		} else {
// 			throw new ArgumentException("params");
// 		}
// 	}

// 	export function parseBatchArgs(args: string): Array<price.Argument> {
// 		const argsRegex = /^[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+(,[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+)*$/;
// 		if (!args) { throw new ArgumentException("args"); }
// 		if (!argsRegex.test(args)) {
// 			throw new ArgumentException("args");
// 		}
// 		const argTokens = args.split(",");
// 		const result: Array<price.Argument> = [];
// 		argTokens.forEach(argToken => {
// 			const parts = argToken.split(":");
// 			const ts: number = parseInt(parts[0]);
// 			const marketCurrency: string = parts[1];
// 			const tradeCurrency: string = parts[2];
// 			const sourceId: string | undefined = undefined;
// 			const requiredAllSourceIds = false;

// 			result.push({ ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds });
// 		});
// 		return result;
// 	}

// 	export function render(prices: price.Timestamp): string {
// 		return JSON.stringify(prices, undefined, "  ");
// 	}

// 	export function renderForSingle(prices: price.Timestamp, arg: price.Argument): string {
// 		const avgAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
// 		if ("sources" in avgAndSource) {
// 			const sources = "sources";
// 			const exchange = avgAndSource[sources];
// 			const nameExchange = arg.sourceId;
// 			if (nameExchange && exchange) {
// 				const priceName = "price";
// 				return exchange[nameExchange][priceName];
// 			}
// 		}
// 		return "null";
// 	}

// 	export function renderForBatch(prices: price.Timestamp, args: Array<price.Argument>): string {
// 		const friendly: any = {};

// 		for (let i = 0; i < args.length; i++) {
// 			const arg = args[i];
// 			const key = `${arg.ts}:${arg.marketCurrency}:${arg.tradeCurrency}`;
// 			const avgAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
// 			if ("avg" in avgAndSource) {
// 				const avg = "avg";
// 				const priceAvg = avgAndSource[avg];
// 				const priceName = "price";
// 				if (priceAvg) {
// 					const friendlyPrice = priceAvg[priceName];
// 					friendly[key] = friendlyPrice;
// 				}
// 			} else {
// 				friendly[key] = null;
// 			}
// 		}
// 		return JSON.stringify(friendly, undefined, "  ");
// 	}
// }
