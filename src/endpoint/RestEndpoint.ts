import { Financial, Logger } from "@zxteam/contract";
import { wrapErrorIfNeeded, ArgumentError } from "@zxteam/errors";
import { Configuration as HostingConfiguration, ServersBindEndpoint, WebServer } from "@zxteam/hosting";

import * as _ from "lodash";
import * as compression from "compression";
import * as express from "express";
import * as moment from "moment";


import { PriceApi } from "../api/PriceApi";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/cancellation";
import { BuildInfo, BuildInfoImpl, DevelBuildInfo } from "../BuildInfo";
import financial from "@zxteam/financial";
import { padStart } from "lodash";

export class RestEndpoint extends ServersBindEndpoint {
	protected readonly _router: express.Router;
	private readonly _priceService: PriceApi;

	public constructor(priceService: PriceApi, servers: ReadonlyArray<WebServer>, opts: HostingConfiguration.BindEndpoint, log: Logger) {
		super(servers, opts, log);
		this._priceService = priceService;
		this._router = express.Router();
		this._router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (this.disposing || this.disposed) {
				return res.writeHead(503, "Service temporary unavailable. Going to maintenance...").end();
			} else {
				next();
			}
		});

		this._router.use(middlewareBindURL(opts.bindPath));
		this._router.use(compression());
		this._router.get("/info", (req: express.Request, res: express.Response, next: express.NextFunction) => {
			let info: BuildInfo;
			if (process.env["NODE_ENV"] === "development") {
				info = new DevelBuildInfo();
			} else {
				info = new BuildInfoImpl();
			}
			return res.status(200).end(JSON.stringify(info, null, "  "));
		});
		this._router.get("/ping", this.onPing.bind(this));
		this._router.get("/prepare-prices", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
			try {
				if (log.isTraceEnabled) { log.trace(`Prepare prices request ${req.url}`); }

				const args = priceRuntime.parsePreparePriceParams(req.query);
				if (log.isTraceEnabled) { log.trace(`Args: ${JSON.stringify(args)}`); }
				let prices;
				if (args.marketCurrency && args.tradeCurrency) {
					prices = await priceService.preparePrices(DUMMY_CANCELLATION_TOKEN, args);
				} else if (args.pairs) {
					prices = await priceService.preparePairPrices(DUMMY_CANCELLATION_TOKEN, args);
				} else {
					throw new ArgumentError("Arguments marketCurrency and tradeCurrency or pairs must be set")
				}
				return res.status(200).end(priceRuntime.renderPreparedPrices(prices));
			} catch (e) {
				if (e instanceof ArgumentError) {
					log.error(e.message);
					return render400(res, "Bad argument in request");
				}
				if (e instanceof PriceApi.InvalidDateError) {
					log.error(e.message);
					return render400(res, "Invalid format date");
				}
				next(e);
			}
		});
		this._router.get("/historical/:args", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
			try {
				if (log.isTraceEnabled) { log.trace(`Price request ${req.url}`); }
				const args = priceRuntime.parseArgs(req.params.args);
				if (log.isTraceEnabled) { log.trace(`Args: ${JSON.stringify(args)}`); }
				const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args);
				return res.status(200).end(priceRuntime.render(prices));
			} catch (e) {
				if (e instanceof ArgumentError) {
					log.error(e.message);
					return render400(res, "Bad argument in request");
				}
				if (e instanceof PriceApi.InvalidDateError) {
					log.error(e.message);
					return render400(res, "Invalid format date");
				}
				next(e);
			}
		});
		this._router.get("/rate", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
			try {
				if (log.isTraceEnabled) { log.trace(`Rate single request ${req.url}`); }
				const arg = priceRuntime.parseSingleParams(req.query);
				const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, [arg]);
				const result = priceRuntime.renderForRate(prices, arg);
				return res.status(200).end(JSON.stringify(result));
			} catch (e) {
				if (e instanceof ArgumentError) {
					log.error(e.message);
					return render400(res, "Bad argument in request");
				}
				if (e instanceof PriceApi.InvalidDateError) {
					log.error(e.message);
					return render400(res, "Invalid format date");
				}
				next(e);
			}
		});
		this._router.get("/batch", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
			try {
				if (log.isTraceEnabled) { log.trace(`Rate batch request ${req.url}`); }
				const args = priceRuntime.parseBatchArgs(req.query.items as string);
				const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args);
				return res.status(200).end(priceRuntime.renderForBatch(prices, args));
			} catch (e) {
				if (e instanceof ArgumentError) {
					log.error(e.message);
					return render400(res, "Bad argument in request");
				}
				if (e instanceof PriceApi.InvalidDateError) {
					log.error(e.message);
					return render400(res, "Invalid format date");
				}
				next(e);
			}
		});
		this._router.get("/history/:baseCurrency/:quoteCurrency", async (req: express.Request, res: express.Response, next: express.NextFunction) => {
			try {
				const args: PriceApi.HistoryArgument = priceRuntime.parseHistoryParams(req.query);
				const deltaUnixSpan: number = (args.toDate.getTime() - args.fromDate.getTime());
				const middleUnixTime: number = args.fromDate.getTime() + (deltaUnixSpan / 2);
				const middleDate: Date = new Date(middleUnixTime);
				const middleTs: number = Number.parseInt(moment.utc(middleDate).format("YYYYMMDDHHmmss"));

				const price: PriceApi.Timestamp = await this._priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, [{
					ts: middleTs,
					marketCurrency: req.params.baseCurrency,
					tradeCurrency: req.params.quoteCurrency,
					sourceId: args.sourceId,
					requiredAllSourceIds: false
				}]);

				const results: Array<{
					date: Date;
					rate: Financial;
				}> = [];
				const segement = deltaUnixSpan / (args.points);
				const rate: Financial = financial.parse(price[middleTs][req.params.baseCurrency][req.params.quoteCurrency].primary!.price);
				for (let point = 0; point < args.points; ++point) {
					results.push({
						date: new Date(args.fromDate.getTime() + point * segement),
						rate: rate.multiply(financial.fromFloat(1 + Math.random() * 0.1), 8, Financial.RoundMode.Trunc)
					});
				}
				return res.status(200).end(JSON.stringify(results.map(e => ({
					date: e.date.toISOString(),
					rate: e.rate.toString()
				}))));
				// if (log.isTraceEnabled) { log.trace(`Chart request ${req.url}`); }
				// const args = priceRuntime.parseBatchArgs(req.query.items as string);
				// const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args);
				// return res.status(200).end(priceRuntime.renderForBatch(prices, args));
			} catch (e) {
				if (e instanceof ArgumentError) {
					log.error(e.message);
					return render400(res, "Bad argument in request");
				}
				if (e instanceof PriceApi.InvalidDateError) {
					log.error(e.message);
					return render400(res, "Invalid format date");
				}
				next(e);
			}
		});
		this._router.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (err) {
				this._log.error(`Unhandled error ${err.message}`);
				return render500(res, "Sorry, something happened...");
			}
			return render404(res, "400 Bad Request. See server's log for details.");
		});
	}

	protected onInit(): void {
		for (const server of this._servers) {
			const rootExpressApplication = server.rootExpressApplication;
			rootExpressApplication.use(this._bindPath, this._router);
		}
	}

	protected onDispose(): void {
		//
	}

	protected _bodyObjectParser(req: express.Request, res: express.Response, next: express.NextFunction): void {
		if (req.method === "GET") {
			return next();
		}

		if (req.body instanceof Buffer) {
			if (req.header("Content-Type") !== "application/json") {
				return res.writeHead(400, "Expected Content-Type to be application/json").end();
			}

			try {
				const jsonStr: string = req.body.toString("utf8");
				(req as any).bodyObject = JSON.parse(jsonStr);
				return next();
			} catch (e) {
				return res.writeHead(400, "Expected JSON in body").end();
			}

		} else {
			return next(new Error("JSON Body parser expected body to be a Buffer"));
		}
	}

	protected safeBinder(cb: (req: express.Request, res: express.Response) => (void | Promise<void>)) {
		const handler = (req: express.Request, res: express.Response): void => {
			try {
				const result = cb(req, res);
				if (result instanceof Promise) {
					result.catch((e) => this.errorRenderer(wrapErrorIfNeeded(e), res));
				}
			} catch (e) {
				this.errorRenderer(wrapErrorIfNeeded(e), res);
			}
		};
		return handler;
	}

	protected errorRenderer(e: Error, res: express.Response): void {
		if (this._log.isWarnEnabled) {
			this._log.warn(`Unhandled error on ${this.constructor.name}: ${e.message}`);
		} else {
			console.error(`Unhandled error on ${this.constructor.name}: ${e.message}`);
		}
		if (this._log.isDebugEnabled) { this._log.debug(`Unhandled error on ${this.constructor.name}`, e); }
		res.status(500).end();
	}

	private async onPing(req: express.Request, res: express.Response): Promise<void> {
		const echoMessage = req.query.echo;
		if (typeof echoMessage !== "string") {
			res.writeHead(400);
			res.end();
		} else {
			try {
				const { echo, time, version } = await this._priceService.ping(DUMMY_CANCELLATION_TOKEN, echoMessage);
				return res.json({ echo, time: time.toISOString(), version }).end();
			} catch (e) {
				const errMessage = e.message;
				return res.writeHead(500, errMessage).end();
			}
		}
	}
}



declare module "express-serve-static-core" {
	interface Request {
		/**
		 *  should ends with slash
		 */
		bindURL: string;
		number: number;
	}
}

export function middlewareBindURL(endpointBindPath: string):
	(req: express.Request, res: express.Response, next: express.NextFunction) => void {
	while (endpointBindPath.startsWith("/")) {
		// remove starting slash
		endpointBindPath = endpointBindPath.slice(1);
	}
	while (endpointBindPath.endsWith("/")) {
		// remove tailing slash
		endpointBindPath = endpointBindPath.slice(0, -1);
	}
	return function (req: express.Request, res: express.Response, next: express.NextFunction) {
		/*
		This code provide support for non-RFC header X-Forwarded-Path
		When we start the service behind a proxy, the proxy is able to rewrite path in URL
		For example
			proxy url: https://service.zxtrader.com/exchanges/
			service url https://X.X.X.X:8080/
		and the service wants to make final URL to logo image
			https://service.zxtrader.com/exchanges/api/v1/BINANCE/logo
		but the service knows only
			https://X.X.X.X:8080/
		There 2 two solutions:
			1) add https://service.zxtrader.com/exchanges/ as "bindURL" into service configuration (used in a lot of apps)
			2) pass "bindURL" from proxy server as X-Forwarded-Path header
		We use (2) to prevent to be able to use the service behind serveral different proxies (with different configuration) same time
		*/
		const protocol = req.header("X-Forwarded-Proto") || req.protocol;
		const host = req.header("X-Forwarded-Host") || req.header("Host") || req.host;
		let forwardedPath = req.header("X-Forwarded-Path");
		if (forwardedPath !== undefined) {
			while (forwardedPath.startsWith("/")) {
				// remove starting slash
				forwardedPath = forwardedPath.slice(1);
			}
			while (forwardedPath.endsWith("/")) {
				// remove tailing slash
				forwardedPath = forwardedPath.slice(0, -1);
			}
			req.bindURL = `${protocol}://${host}/${forwardedPath}/${endpointBindPath}/`; // should ends with slash
		} else {
			req.bindURL = `${protocol}://${host}/${endpointBindPath}/`; // should ends with slash
		}
		return next();
	};
}


function renderStatus(res: express.Response, code: number, description?: string): void {
	res.status(code);
	if (description !== undefined) {
		res.statusMessage = description;
	}
	res.end();
}
function render400(res: express.Response, description?: string): void {
	renderStatus(res, 400, description);
}
function render404(res: express.Response, description?: string): void {
	renderStatus(res, 401, description);
}
function render500(res: express.Response, description?: string): void {
	if (!res.headersSent) {
		renderStatus(res, 500, description);
	} else if (!res.finished) {
		res.end();
	}
}

namespace priceRuntime {
	export function parseArgs(args: string): Array<PriceApi.Argument> {
		const argsRegex = /^[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?(,[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?)*$/;
		if (!args) { throw new ArgumentError("args"); }
		if (!argsRegex.test(args)) {
			throw new ArgumentError("args");
		}
		const argTokens = args.split(",");
		const result: Array<PriceApi.Argument> = [];
		argTokens.forEach(argToken => {
			const parts = argToken.split(":");
			const ts: number = parseInt(parts[0]);
			const marketCurrency: string = parts[1];
			const tradeCurrency: string = parts[2];
			const sourceId: string | undefined = parts.length === 4 && parts[3] || undefined;
			const requiredAllSourceIds = !sourceId && parts.length === 4;

			result.push({ ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds });
		});
		return result;
	}

	export function parseSingleParams(params: any): PriceApi.Argument {
		const { date, marketCurrency, tradeCurrency, exchange } = params;
		const ts: number = date !== undefined ? Number.parseInt(date) : Number.parseInt(moment.utc().format("YYYYMMDDHHmmss"));
		if (_.isString(marketCurrency) && _.isString(tradeCurrency)) {
			return {
				sourceId: exchange,
				ts,
				marketCurrency,
				tradeCurrency,
				requiredAllSourceIds: false
			};
		} else {
			throw new ArgumentError("params");
		}
	}

	export function parsePreparePriceParams(params: any): PriceApi.PreparePriceArgument {
		const { fromDate, toDate, pairs, points, marketCurrency, tradeCurrency, exchange } = params;
		if (((_.isString(marketCurrency) && _.isString(tradeCurrency)) || _.isString(pairs)) && _.isString(fromDate) && _.isString(toDate) && _.isString(points)) {
			const agrs: PriceApi.PreparePriceArgument = {
				sourceId: exchange,
				fromDate: Number.parseInt(fromDate),
				toDate: Number.parseInt(toDate),
				points: Number.parseInt(points),
				requiredAllSourceIds: false
			};
			if (_.isString(marketCurrency) && _.isString(tradeCurrency)) {
				agrs.marketCurrency = marketCurrency;
				agrs.tradeCurrency = tradeCurrency;
			} else if (_.isString(pairs)) {
				agrs.pairs = pairs.split(",");
			} else {
				throw new ArgumentError("Arguments marketCurrency and tradeCurrency or pairs must be set");
			}
			return agrs;
		} else {
			throw new ArgumentError("params");
		}
	}

	export function parseHistoryParams(params: any): PriceApi.HistoryArgument {
		const { fromDate, toDate, points, exchange } = params;
		if (_.isString(fromDate) && _.isString(toDate) && _.isString(points)) {
			const agrs: PriceApi.HistoryArgument = {
				sourceId: exchange,
				fromDate: new Date(fromDate),
				toDate: new Date(toDate),
				points: Number.parseInt(points)
			};
			return agrs;
		} else {
			throw new ArgumentError("params");
		}
	}

	export function parseBatchArgs(args: string): Array<PriceApi.Argument> {
		const argsRegex = /^[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+(,[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+)*$/;
		if (!args) { throw new ArgumentError("args"); }
		if (!argsRegex.test(args)) {
			throw new ArgumentError("args");
		}
		const argTokens = args.split(",");
		const result: Array<PriceApi.Argument> = [];
		argTokens.forEach(argToken => {
			const parts = argToken.split(":");
			const ts: number = parseInt(parts[0]);
			const marketCurrency: string = parts[1];
			const tradeCurrency: string = parts[2];
			const sourceId: string | undefined = undefined;
			const requiredAllSourceIds = false;

			result.push({ ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds });
		});
		return result;
	}

	export function render(prices: PriceApi.Timestamp): string {
		return JSON.stringify(prices, undefined, "  ");
	}


	export function renderPreparedPrices(prices: PriceApi.Timestamp): string {
		const resultPrices: any = {};
		for (const ts in prices) {
			if (!(ts in resultPrices)) {
				resultPrices[ts] = {};
			}
			for (const marketCurrency in prices[ts]) {
				if (!(marketCurrency in resultPrices[ts])) {
					resultPrices[ts][marketCurrency] = {};
				}
				for (const tradeCurrency in prices[ts][marketCurrency]) {
					if (!(tradeCurrency in resultPrices[ts][marketCurrency])) {
						resultPrices[ts][marketCurrency][tradeCurrency] = {};
					}
					const primaryPrice = prices[ts][marketCurrency][tradeCurrency];
					resultPrices[ts][marketCurrency][tradeCurrency] = primaryPrice.primary?.price;
				}
			}
		}
		return JSON.stringify(resultPrices, undefined, "  ");
	}

	export function renderForSingle(prices: PriceApi.Timestamp, arg: PriceApi.Argument): string | null {
		const primaryAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
		if ("sources" in primaryAndSource) {
			const sources = "sources";
			const exchange = primaryAndSource[sources];
			const nameExchange = arg.sourceId;
			if (nameExchange && exchange) {
				const priceName = "price";
				return exchange[nameExchange][priceName];
			}
		}
		return null;
	}

	export function renderForRate(prices: PriceApi.Timestamp, arg: PriceApi.Argument): string | null {
		const primaryAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
		if ("primary" in primaryAndSource) {
			const primary = "primary";
			const pricePrimary = primaryAndSource[primary];
			const priceName = "price";
			if (pricePrimary) {
				return pricePrimary[priceName];
			}
			return null;
		}
		return null;
	}

	export function renderForBatch(prices: PriceApi.Timestamp, args: Array<PriceApi.Argument>): string {
		const friendly: any = {};

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const key = `${arg.ts}:${arg.marketCurrency}:${arg.tradeCurrency}`;
			const primaryAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
			if ("primary" in primaryAndSource) {
				const primary = "primary";
				const pricePrimary = primaryAndSource[primary];
				const priceName = "price";
				if (pricePrimary) {
					const friendlyPrice = pricePrimary[priceName];
					friendly[key] = friendlyPrice;
				} else {
					friendly[key] = null;
				}
			} else {
				friendly[key] = null;
			}
		}
		return JSON.stringify(friendly);
	}

	// export function renderForChart 
}
