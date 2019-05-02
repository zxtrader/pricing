import { PriceService } from "../PriceService";
import expressRouter from "./routes";

import * as zxteam from "@zxteam/contract";
import { Initable } from "@zxteam/disposable";
import { loggerFactory } from "@zxteam/logger";

import * as express from "express";
import * as fs from "fs";
import * as http from "http";
import * as https from "https";
import * as morgan from "morgan";  // Logging middleware

import { Configuration } from "../conf";

export class HttpEndpoint extends Initable {
	private readonly _log: zxteam.Logger;
	private readonly _opts: Configuration.HttpEndpoint | Configuration.HttpsEndpoint;
	private readonly _expressApp: express.Application;
	private _server: http.Server | https.Server | null;

	public constructor(
		expressApp: express.Application,
		opts: Configuration.HttpEndpoint | Configuration.HttpsEndpoint,
		log?: zxteam.Logger
	) {
		super();
		this._expressApp = expressApp;
		this._opts = opts;
		this._log = log || loggerFactory.getLogger(this.constructor.name);
		this._server = null;
	}

	protected async onInit() {
		if (this._opts.type === "https") {
			const opts: Configuration.HttpsEndpoint = this._opts;
			this._server = await new Promise<https.Server>((resolve, reject) => {
				// Make HTTPS server instance
				const serverOpts: https.ServerOptions = {
					ca: opts.caCertificate instanceof Buffer ? opts.caCertificate : fs.readFileSync(opts.caCertificate),
					cert: opts.serviceCertificate instanceof Buffer ? opts.serviceCertificate : fs.readFileSync(opts.serviceCertificate),
					key: opts.serviceKey instanceof Buffer ? opts.serviceKey : fs.readFileSync(opts.serviceKey)
				};
				if (opts.serviceKeyPassword !== undefined) {
					serverOpts.passphrase = opts.serviceKeyPassword;
				}
				if (opts.requireClientCertificate === true) {
					serverOpts.requestCert = true;
					serverOpts.rejectUnauthorized = true;
				}
				const httpsServer = https.createServer(serverOpts, this._expressApp);
				this._log.info("Starting Web Server...");

				httpsServer
					.on("listening", () => {
						const address = httpsServer.address();
						if (address !== null) {
							if (typeof address === "string") {
								this._log.info(`Web Server was started on ${address}`);
							} else {
								this._log.info(address.family + " Web Server was started on https://" + address.address + ":" + address.port);
							}
						}
						resolve(httpsServer);
					})
					.on("error", reject)
					.listen(this._opts.listenPort, this._opts.listenHost);
			});
		} else {
			const opts: Configuration.HttpEndpoint = this._opts;
			this._server = await new Promise<http.Server>((resolve, reject) => {
				// Make HTTP server instance
				const httpServer = http.createServer(this._expressApp);
				this._log.info("Starting Web Server...");

				httpServer
					.on("listening", () => {
						const address = httpServer.address();
						if (address !== null) {
							if (typeof address === "string") {
								this._log.info(`Web Server was started on ${address}`);
							} else {
								this._log.info(address.family + " Web Server was started on http://" + address.address + ":" + address.port);
							}
						}
						resolve(httpServer);
					})
					.on("error", reject)
					.listen(opts.listenPort, opts.listenHost);
			});
		}
	}

	protected async onDispose() {
		const httpServer = this._server;
		if (httpServer !== null) {
			const address = httpServer.address();
			this._server = null;
			if (address !== null) {
				if (typeof address === "string") {
					this._log.info("Stoping Web Server http://" + address + "...");
				} else {
					this._log.info("Stoping " + address.family + " Web Server http://" + address.address + ":" + address.port + "...");
				}
			} else {
				this._log.info("Stoping Web Server...");
			}
			await new Promise((destroyResolve) => {
				httpServer.close((err) => {
					if (err) {
						this._log.warn("The Web Server closed with error", err);
					} else {
						this._log.info("The Web Server was stopped");
					}
					destroyResolve();
				});
			});
		}
	}
}

export function expressAppInit(service: PriceService, log: zxteam.Logger): express.Application {
	log.info("Setuping Express...");
	const app = express();

	// Set logger. Available values: "dev", "short", "tiny". or no argument (default)
	app.use(morgan("dev"));

	app.use("/v1", expressRouter(service));
	//app.use("/v2", v2(service));

	// 404 Not found (bad URL)
	app.use(function (req: express.Request, res: express.Response): any {
		return res.status(404).end("404 Not Found");
	});

	// 5xx Fatal error
	app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
		if (err) {
			//TODO: send email, log err, etc...
			log.error(err);
		}
		//return res.status(500).end("500 Internal Error");
		return next(err); // use express excepton render
	});

	return app;
}
