
// export function createExpressApplication(log: zxteam.Logger): express.Application {
// 	log.info("Constructing Express application...");
// 	const app = express();

// 	// https://expressjs.com/en/api.html#app.settings.table
// 	app.enable("case sensitive routing"); // "/Foo" and "/foo" should be different routes
// 	if (!("NODE_ENV" in process.env)) {
// 		app.set("env", "production"); // by default use production mode
// 	}
// 	app.enable("strict routing"); // the router should treat "/foo" and "/foo/" as different.
// 	app.disable("x-powered-by"); // Hide real www server (security reason)


// 	let reqCounter = 0;

// 	app.use(function (req, res, next) {
// 		req.number = ++reqCounter;
// 		if (log.isTraceEnabled) {
// 			log.trace(`Req #${req.number}: `, req.originalUrl, req.headers);
// 		}
// 		return next();
// 	});

// 	// Set logger. Available values: "dev", "short", "tiny". or no argument (default)
// 	app.use(morgan("dev"));

// 	return app;
// }

// export function setupExpressErrorHandles(app: express.Application, log: zxteam.Logger): void {
// 	// 404 Not found (bad URL)
// 	app.use(function (req: express.Request, res: express.Response) { res.status(404).end("404 Not Found"); });

// 	// 5xx Fatal error
// 	app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
// 		if (err) {
// 			//TODO: send email, log err, etc...
// 			log.error(err);
// 		}
// 		//return res.status(500).end("500 Internal Error");
// 		return next(err); // use express excepton render
// 	});
// }
