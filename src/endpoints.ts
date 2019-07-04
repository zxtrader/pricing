import * as zxteam from "@zxteam/contract";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
import * as webserver from "@zxteam/webserver";

import * as express from "express";
import * as compression from "compression";
import * as morgan from "morgan";  // Logging middleware
import * as _ from "lodash";
import * as path from "path";

import { Configuration } from "./conf";
import { PriceService, ArgumentException, InvalidDateError, price } from "./PriceService";
const { version } = require(path.join(__dirname, "..", "package.json"));

export class PriceServiceRestEndpoint extends webserver.RestEndpoint<PriceService> {
	private readonly _bindPathWeb: string | null;

	public constructor(
		servers: ReadonlyArray<webserver.WebServer>,
		service: PriceService,
		opts: Configuration.PriceServiceRestEndpoint,
		log: zxteam.Logger
	) {
		super(servers, service, opts, log);
		this._bindPathWeb = opts.bindPathWeb;
	}

	protected onInit(): void {
		for (const server of this._servers) {
			const app: express.Application = server.rootExpressApplication;

			const apiRouter = apiV1(this._service, this._bindPath, this._log);
			app.use(this._bindPath, apiRouter);
		}
	}

	protected onDispose(): void {
		// NOOP
	}
}

export class PriceServiceWebSocketEndpoint extends webserver.WebSocketEndpoint { }

export class PriceServiceRouterEndpoint extends webserver.BindEndpoint {
	private readonly _service: PriceService;
	private readonly _router: express.Router;

	public constructor(
		servers: ReadonlyArray<webserver.WebServer>,
		service: PriceService,
		opts: Configuration.PriceServiceExpressRouterEndpoint,
		log: zxteam.Logger
	) {
		super(servers, opts, log);
		this._service = service;
		this._router = opts.router;
	}


	protected onInit(): void {
		this._router.use(apiV1(this._service, this._bindPath, this._log));
	}

	protected onDispose(): void {
		// NOOP
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

function middlewareBindURL(endpointBindPath: string): (req: express.Request, res: express.Response, next: express.NextFunction) => void {
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
		const host = req.header("dock") || req.header("Host") || req.host;
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

export function createExpressApplication(log: zxteam.Logger): express.Application {
	log.info("Constructing Express application...");
	const app = express();

	// https://expressjs.com/en/api.html#app.settings.table
	app.enable("case sensitive routing"); // "/Foo" and "/foo" should be different routes
	if (!("NODE_ENV" in process.env)) {
		app.set("env", "production"); // by default use production mode
	}
	app.enable("strict routing"); // the router should treat "/foo" and "/foo/" as different.
	app.disable("x-powered-by"); // Hide real www server (security reason)


	let reqCounter = 0;

	app.use(function (req, res, next) {
		req.number = ++reqCounter;
		if (log.isTraceEnabled) {
			log.trace(`Req #${req.number}: `, req.originalUrl, req.headers);
		}
		return next();
	});

	// Set logger. Available values: "dev", "short", "tiny". or no argument (default)
	app.use(morgan("dev"));

	return app;
}

export function setupExpressErrorHandles(app: express.Application, log: zxteam.Logger): void {
	// 404 Not found (bad URL)
	app.use(function (req: express.Request, res: express.Response) { res.status(404).end("404 Not Found"); });

	// 5xx Fatal error
	app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
		if (err) {
			//TODO: send email, log err, etc...
			log.error(err);
		}
		//return res.status(500).end("500 Internal Error");
		return next(err); // use express excepton render
	});
}

function apiV1(service: PriceService, bindPath: string, log: zxteam.Logger): express.Router {
	// const expressRouter: express.Router = (route) ? route : express.Router();
	const router = express.Router({ strict: true });


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

	router.use(middlewareBindURL(bindPath));
	router.use(compression());

	router.get("/ping", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
		try {
			const { echo } = req.query;
			const time = new Date();
			return res.status(200).end(JSON.stringify({
				echo,
				time: time.toString(),
				version
			}));
		} catch (e) {
			if (e instanceof ArgumentException) {
				log.error(e.message);
				return render400(res, "Bad argument in request");
			}
			next(e);
		}
	});

	router.get("/price/:args", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
		try {
			if (log.isTraceEnabled) { log.trace(`Price request ${req.url}`); }
			const args = priceRuntime.parseArgs(req.params.args);
			if (log.isTraceEnabled) { log.trace(`Args: ${JSON.stringify(args)}`); }
			const prices = await service.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;
			return res.status(200).end(priceRuntime.render(prices));
		} catch (e) {
			if (e instanceof ArgumentException) {
				log.error(e.message);
				return render400(res, "Bad argument in request");
			}
			if (e instanceof InvalidDateError) {
				log.error(e.message);
				return render400(res, "Invalid format date");
			}
			next(e);
		}
	});

	router.get("/rate/single", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
		try {
			if (log.isTraceEnabled) { log.trace(`Rate single request ${req.url}`); }
			const arg = priceRuntime.parseSingleParams(req.query);
			const prices = await service.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, [arg]).promise;
			return res.status(200).end(priceRuntime.renderForSingle(prices, arg));
		} catch (e) {
			if (e instanceof ArgumentException) {
				log.error(e.message);
				return render400(res, "Bad argument in request");
			}
			if (e instanceof InvalidDateError) {
				log.error(e.message);
				return render400(res, "Invalid format date");
			}
			next(e);
		}
	});

	router.get("/rate/batch", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
		try {
			if (log.isTraceEnabled) { log.trace(`Rate batch request ${req.url}`); }
			const args = priceRuntime.parseBatchArgs(req.query.items);
			const prices = await service.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;
			return res.status(200).end(priceRuntime.renderForBatch(prices, args));
		} catch (e) {
			if (e instanceof ArgumentException) {
				log.error(e.message);
				return render400(res, "Bad argument in request");
			}
			if (e instanceof InvalidDateError) {
				log.error(e.message);
				return render400(res, "Invalid format date");
			}
			next(e);
		}
	});

	router.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
		if (err) {
			log.error(`Unhandled error ${err.message}`);
			return render500(res, "Sorry, something happened...");
		}
		return render404(res, "400 Bad Request. See server's log for details.");
	});

	return router;
}

export namespace priceRuntime {
	export function parseArgs(args: string): Array<price.Argument> {
		const argsRegex = /^[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?(,[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?)*$/;
		if (!args) { throw new ArgumentException("args"); }
		if (!argsRegex.test(args)) {
			throw new ArgumentException("args");
		}
		const argTokens = args.split(",");
		const result: Array<price.Argument> = [];
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

	export function parseSingleParams(params: any): price.Argument {
		const { exchange, date, market, trade } = params;
		if (exchange && date && market && trade) {
			return {
				sourceId: exchange,
				ts: +date,
				marketCurrency: market,
				tradeCurrency: trade,
				requiredAllSourceIds: false
			};
		} else {
			throw new ArgumentException("params");
		}
	}

	export function parseBatchArgs(args: string): Array<price.Argument> {
		const argsRegex = /^[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+(,[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+)*$/;
		if (!args) { throw new ArgumentException("args"); }
		if (!argsRegex.test(args)) {
			throw new ArgumentException("args");
		}
		const argTokens = args.split(",");
		const result: Array<price.Argument> = [];
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

	export function render(prices: price.Timestamp): string {
		return JSON.stringify(prices, undefined, "  ");
	}

	export function renderForSingle(prices: price.Timestamp, arg: price.Argument): string {
		const avgAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
		if ("sources" in avgAndSource) {
			const sources = "sources";
			const exchange = avgAndSource[sources];
			const nameExchange = arg.sourceId;
			if (nameExchange && exchange) {
				const priceName = "price";
				return exchange[nameExchange][priceName];
			}
		}
		return "null";
	}

	export function renderForBatch(prices: price.Timestamp, args: Array<price.Argument>): string {
		const friendly: any = {};

		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const key = `${arg.ts}:${arg.marketCurrency}:${arg.tradeCurrency}`;
			const avgAndSource = prices[arg.ts][arg.marketCurrency][arg.tradeCurrency];
			if ("avg" in avgAndSource) {
				const avg = "avg";
				const priceAvg = avgAndSource[avg];
				const priceName = "price";
				if (priceAvg) {
					const friendlyPrice = priceAvg[priceName];
					friendly[key] = friendlyPrice;
				}
			} else {
				friendly[key] = null;
			}
		}
		return JSON.stringify(friendly);
	}
}
