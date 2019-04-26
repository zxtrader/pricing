import { Runtime } from "@zxteam/launcher";
import { loggerFactory } from "@zxteam/logger";
import * as express from "express";
import * as http from "http";
import * as morgan from "morgan";  // Logging middleware

export default async function (
	opts: {
		storageUrl: URL,
		httpOpts?: {
			listenHost: string,
			listenPort: number
		},
		httpsOpts?: {
			listenHost: string,
			listenPort: number,
			ca?: Array<string>,
			cert: string,
			key: string,
			keyPassphase?: string
		}
	}
): Promise<Runtime> {
	const log = loggerFactory.getLogger("ZXTrader's Price Service");

	log.info("Setuping Express...");
	const app = express();

	// Set logger. Available values: "dev", "short", "tiny". or no argument (default)
	app.use(morgan("dev"));


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
