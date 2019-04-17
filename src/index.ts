import * as express from "express";
import * as https from "https";
import * as http from "http";
import * as fs from "fs";
import { TLSSocket } from "tls";
import * as log4js from "log4js";
import * as morgan from "morgan";  // Logging middleware
import * as path from "path";
import { Logger } from "@zxteam/contract";
import { loggerFactory, setEngine, LoggerFactory } from "@zxteam/logger";

import { default as configManager } from "./conf";
import routes from "./routes";

const USE_CLIENT_SSL = configManager.getBoolean("service.useClientSsl");
const NODE_ENV = configManager.getString("service.nodeEnv");


// Configure logger
class Log4jsEngineAdapter implements LoggerFactory {
	private readonly _wrap: log4js.Log4js;

	public constructor(config: string | log4js.Configuration) {
		if (typeof config === "string") {
			this._wrap = log4js.configure(config);
		} else {
			this._wrap = log4js.configure(config);
		}
	}

	public getLogger(category: string): Logger {
		const loggerWrap: any = this._wrap.getLogger(category);

		const logger: any = {};

		["trace", "debug", "info", "warn", "error", "fatal"].forEach(level => {
			logger[level] = (...args: any[]) => loggerWrap[level](...args);
			const capitalizeLevel = level.charAt(0).toUpperCase() + level.substr(1);
			Object.defineProperty(logger, `is${capitalizeLevel}Enabled`, {
				get: () => loggerWrap[`is${capitalizeLevel}Enabled`]()
			});
		});

		return logger;
	}
}

const loggerEngne = new Log4jsEngineAdapter(path.join(__dirname, "..", "log4js.json"));
setEngine(loggerEngne);

const log = loggerFactory.getLogger("index");
log.trace("= TRACE IS ENABLED =");

log.info("Initializing application...");

const app = express();

// Set logger. Available values: "dev", "short", "tiny". or no argument (default)
app.use(morgan("dev"));

if (NODE_ENV !== "development" || USE_CLIENT_SSL) {
	app.use((req, res, next) => {
		const cert = ((req.socket) as TLSSocket).getPeerCertificate();

		if (((req.socket) as TLSSocket).authorized) {
			log.info(`Authentication ${cert.subject.CN} certificates from ${cert.issuer.CN}`);
			next();
			return;
		} else if (cert.subject) {
			const message = "Invalid certificate";
			res.status(403).end(message);
			log.info(`Invalid certificate ${cert.subject.CN} from ${cert.issuer.CN}`);
			return;
		} else {
			const message = "You must provide a client certificate";
			res.status(401).end(message);
			log.info(`You must provide a client certificate`);
			return;
		}
	});
}

app.use(routes);

// 404 Not found (bad URL)
app.use(function (req: express.Request, res: express.Response): any {
	if (log.isTraceEnabled) {
		log.trace(`User try get page: ${req.path} it does not exist.`);
	}
	return res.status(404).end("404 Not Found");
});

// 5xx Fatal error
app.use(function (err: any, req: express.Request, res: express.Response): any {
	if (err) {
		//TODO: send email, log err, etc...
		log.error(err);
	}
	return res.status(500).end("500 Internal Error");
});

// Options for Https server
const opts = (USE_CLIENT_SSL) ? {
	key: fs.readFileSync(configManager.getString("service.ssl.key")),
	cert: fs.readFileSync(configManager.getString("service.ssl.cert")),
	ca: fs.readFileSync(configManager.getString("service.ssl.ca")),
	requestCert: true,
	rejectUnauthorized: false
} : {};

// Make HTTP(s) server instance
const server = (USE_CLIENT_SSL) ? https.createServer(opts, app) : http.createServer(app);

// Register "listening" callback
server.on("listening", function (): any {
	const address = server.address();
	if (typeof address === "string") {
		log.info(`Server was started on ${address}`);
	} else if (address) {
		if (log.isTraceEnabled) { log.trace(`USE_CLIENT_SSL: ${USE_CLIENT_SSL}`); }
		log.info(address.family + " server was started on http(s)://" + address.address + ":" + address.port);
	}
});

const listen: string = configManager.getString("service.listen.host");
const port: number = configManager.getInt("service.listen.port");

// Start listening
server.listen(port, listen);

log.info("Starting HTTP Web Server...");
