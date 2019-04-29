import { URL } from "url";
import { RedisOptions } from "ioredis";
import { PriceService } from "./index";
import { loggerFactory } from "@zxteam/logger";
import { RestClient } from "@zxteam/restclient";
import { HttpOpts, HttpEndpoint } from "./rest";
import { default as configManager } from "./configManager";
import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { Cryptocompare } from "./providers/source/Cryptocompare";
import { RedisStorageProvider } from "./providers/storage/RedisStorageProvider";

// == Read configuration from ENV ==
// Mode of service
const priceMode: string = process.env.PRICE_MODE || "demand";
// Url for connection database redis://[username:password@]host[:port][/db-number][?option=value]
const dataStorageUrl: string = process.env.DATASTORAGE_URL || "redis://localhost:6379/5";
// Enable http endpoint
const httpEnable: string = process.env.HTTP_ENABLE || "yes";
// Http host name endpoint
const httpHost: string = process.env.HTTP_HOST || "127.0.0.1";
// Http port endpoint
const httpPort: number = Number.parseInt(process.env.HTTP_PORT || "8080");
// Enable https endpoint
const httpsEnable: string = process.env.HTTPS_ENABLE || "no";
// Https host name endpoint
const httpsHost: string = process.env.HTTP_HOST || "127.0.0.1";
// Https port endpoint
const httpsPort: number = Number.parseInt(process.env.HTTP_PORT || "8443");
// Https list CA cert
const httpsCaCert: Array<string> | null = (process.env.HTTPS_CACERTS) ? (process.env.HTTPS_CACERTS).split(" ") : null;
// Https path to Cart or base64 is string
const httpsCert: string | undefined = process.env.HTTPS_CERT;
// Https path to private key or base64 is string
const httpsKey: string | undefined = process.env.HTTPS_KEY;
// Https password from private key
const httpsKeyPhassPhrase: string | null = (process.env.HTTPS_KEY_PHASSPHRASE) ? process.env.HTTPS_KEY_PHASSPHRASE : null;

const logger = loggerFactory.getLogger("App");

function createPriceService(storage: StorageProvider, sources: Array<SourceProvider>): PriceService {
	const priceService = new PriceService(storage, sources);
	return priceService;
}
function createStorageProvider(): StorageProvider {
	const opts: RedisOptions = helpers.getOptsForRedis();
	const redisStorageProvider = new RedisStorageProvider(opts);
	return redisStorageProvider;
}
function createSourceProviders(): Array<SourceProvider> {
	const sourceIds: Array<string> = configManager.getString("sources").split(" ");
	const friendlySources: Array<SourceProvider> = [];

	// foreach sourceIds and create object don't implement yet.
	sourceIds.forEach((sourceId) => {
		const url = configManager.getString(`source.${sourceId}.url`);
		const parallel = configManager.getInt(`source.${sourceId}.limit.parallel`);
		const perSecond = configManager.getInt(`source.${sourceId}.limit.perSecond`);
		const perMinute = configManager.getInt(`source.${sourceId}.limit.perMinute`);
		const perHour = configManager.getInt(`source.${sourceId}.limit.perHour`);
		const timeout = configManager.getInt(`source.${sourceId}.timeout`);


		const opts: RestClient.Opts = {
			limit: {
				instance: {
					parallel,
					perSecond,
					perMinute,
					perHour
				},
				timeout
			}
		};

		logger.warn("Don't implement create source provider!!!");
		const provider = new Cryptocompare(url, opts);
		friendlySources.push(provider);
	});

	return friendlySources;
}

async function start() {
	const storageProvider: StorageProvider = createStorageProvider();
	const sourceProviders: Array<SourceProvider> = createSourceProviders();
	const priceService: PriceService = createPriceService(storageProvider, sourceProviders);
	try {
		const httpEndpoint = new HttpEndpoint(priceService, logger);
		httpEndpoint.start(helpers.getHttpOpts());
	} catch (err) {
		storageProvider.dispose();
		// I don't know what need do.
		logger.error(err);
		logger.error("Application is close");
	}
}

namespace helpers {
	export function getOptsForRedis(): RedisOptions {

		function praseToOptsRedis(url: URL): RedisOptions {
			const host = url.hostname;
			const port = Number(url.port);
			const db = Number(url.pathname.slice(1));

			const opts: RedisOptions = {
				host,
				port,
				db
			};
			return opts;
		}
		function parseDbServerUrl(url: string): URL {
			try {
				return new URL(url);
			} catch (e) {
				throw new Error(`Wrong DATASTORAGE_URL = ${url}. ${e.message}.`);
			}
		}

		const friendlyUrl = parseDbServerUrl(dataStorageUrl);

		const optsForRedis: RedisOptions = praseToOptsRedis(friendlyUrl);

		return optsForRedis;
	}
	export function getHttpOpts(): HttpOpts {
		if (httpEnable === "yes") {
			const opts = {
				httpOpts: {
					listenHost: httpHost,
					listenPort: httpPort
				}
			};
			return opts;
		}
		if (httpsEnable === "yes") {
			if (httpsCert === undefined) {
				throw new Error("Do not have settings for httpsCert endpoint");
			}
			if (httpsKey === undefined) {
				throw new Error("Do not have settings for httsKey endpoint");
			}
			const opts = {
				httpsOpts: {
					listenHost: httpsHost,
					listenPort: httpsPort,
					ca: httpsCaCert,
					cert: httpsCert,
					key: httpsKey,
					keyPassphase: httpsKeyPhassPhrase
				}
			};
			return opts;
		}
		throw new Error("Http(s) endpoint do not enable");
	}
}

start();
