import * as express from "express";
import { Financial } from "@zxteam/contract";
import { ensureFactory } from "@zxteam/ensure.js";
import { DUMMY_CANCELLATION_TOKEN, Task } from "ptask.js";
import loggerFactory from "@zxteam/logger";
import { PriceService, price } from "..";
import { ArgumentException } from "@zxnode/base";

export default function (priceService: PriceService) {
	const expressRouter: express.Router = express.Router();
	const log = loggerFactory.getLogger("HttpEndpoint v1");

	expressRouter.get("/price/:args", async function (req: express.Request, res: express.Response, next: express.NextFunction) {
		try {
			if (log.isTraceEnabled) { log.trace(`Price request ${req.url}`); }
			const args = priceRuntime.parseArgs(req.params.args);
			if (log.isTraceEnabled) { log.trace(`Args: ${JSON.stringify(args)}`); }
			const prices = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args);
			return res.status(200).end(priceRuntime.render(prices));
		} catch (e) {
			if (e instanceof ArgumentException) {
				if (log.isTraceEnabled) { log.trace(`Bad request`, e); }
				if (log.isInfoEnabled) { log.trace(`Bad request`); }
				return res.status(400).end("Bad request");
			}
			if (log.isTraceEnabled) { log.trace(`Unhandled error`, e); }
			if (log.isWarnEnabled) { log.warn(`Unhandled error ${e.message}`); }
			next(e);
		}
	});

	expressRouter.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
		if (err) {
			log.error(err);
		}
		return res.status(400).end("400 Bad Request. See server's log for details.");
	});

	return expressRouter;
}

namespace priceRuntime {
	const argsRegex = /^[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?(,[0-9]{14}:[A-Z]+:[0-9A-Z]+(:([A-Z_]+)?)?)*$/;

	export function parseArgs(args: string): Array<price.Argument> {
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

	export function render(prices: price.Timestamp): string {
		return JSON.stringify(prices, undefined, "  ");
	}
}
