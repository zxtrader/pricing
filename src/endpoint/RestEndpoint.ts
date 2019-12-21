import { Logger } from "@zxteam/contract";
import { wrapErrorIfNeeded, ArgumentError } from "@zxteam/errors";
import { Configuration as HostingConfiguration, ServersBindEndpoint, WebServer } from "@zxteam/hosting";

import * as express from "express";
import * as bodyParser from "body-parser";

export class RestEndpoint extends ServersBindEndpoint {
	protected readonly _router: express.Router;

	public constructor(servers: ReadonlyArray<WebServer>, opts: HostingConfiguration.BindEndpoint, log: Logger) {
		super(servers, opts, log);
		this._router = express.Router();
		this._router.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (this.disposing || this.disposed) {
				return res.writeHead(503, "Service temporary unavailable. Going to maintenance...").end();
			} else {
				next();
			}
		});
		this._router.use(bodyParser.raw({ limit: "5kb", type: "*/*" }));
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
}

