import * as http from "http";
import { PriceService } from ".";
import * as morgan from "morgan";
import * as express from "express";
import expressRouter from "./routes";
import { Runtime } from "@zxteam/launcher";
import loggerFactory from "@zxteam/logger";

export interface HttpOpts {
	httpOpts?: {
		listenHost: string,
		listenPort: number
	};
	httpsOpts?: {
		listenHost: string,
		listenPort: number,
		ca: Array<string> | null,
		cert: string,
		key: string,
		keyPassphase: string | null
	};
}

export class HttpEndpoint {
	private readonly _priceService: PriceService;

	constructor(priceService: PriceService) {
		this._priceService = priceService;
	}

	public async start(opts: HttpOpts): Promise<Runtime> {
		const log = loggerFactory.getLogger("HttpEndpoint");

		log.info("Setuping Express...");
		const app = express();

		// Set logger. Available values: "dev", "short", "tiny". or no argument (default)
		app.use(morgan("dev"));

		app.use(expressRouter(this._priceService));

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


		const destroyHandlers: Array<() => Promise<void>> = [];

		const { httpOpts } = opts;

		if (httpOpts !== undefined) {
			await new Promise((resolve, reject) => {
				// Make HTTPs server instance
				const httpServer = http.createServer(app);
				log.info("Starting HTTP Web Server...");

				httpServer
					.on("listening", function (): any {
						const address = httpServer.address();
						if (address !== null) {
							if (typeof address === "string") {
								log.info(`Server was started on ${address}`);
							} else {
								log.info(address.family + " server was started on http://" + address.address + ":" + address.port);
							}
						}
						resolve();
					})
					.on("error", reject)
					.listen(httpOpts.listenPort, httpOpts.listenHost);

				destroyHandlers.push(() => {
					log.info("Stoping HTTP Web Server...");
					return new Promise((destroyResolve) => {
						httpServer.close((err) => {
							if (err) {
								log.warn("The HTTP Server closed with error", err);
							} else {
								log.info("The HTTP Web Server was stopped");
							}
							destroyResolve();
						});
					});
				});
			});
		}

		return {
			async destroy() {
				await Promise.all(destroyHandlers.map(destroyHandler => destroyHandler()));
			}
		};
	}

}
