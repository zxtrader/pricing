import { URL } from "url";
import * as express from "express";
import { RedisOptions } from "ioredis";
import { Configuration } from "./conf";
import { PriceService } from "./PriceService";
import { loggerFactory } from "@zxteam/logger";
import { RestClient } from "@zxteam/restclient";
import { launcher, Runtime } from "@zxteam/launcher";
import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { Cryptocompare } from "./providers/source/Cryptocompare";
import { HttpEndpoint, expressAppInit } from "./endpoints/HttpEndpoint";
import { RedisStorageProvider } from "./providers/storage/RedisStorageProvider";
import { Initable } from "@zxteam/disposable";


export default async function (options: ArgumentConfig): Promise<Runtime> {

	// Validate options

	const logger = loggerFactory.getLogger("App");

	const destroyHandlers: Array<() => Promise<void>> = [];
	function destroy(): Promise<void> { return destroyHandlers.reverse().reduce((p, c) => p.then(c), Promise.resolve()); }

	logger.trace("Constructing Storage provider...");
	const dataStorageUrl = String(options.env.dataStorageUrl);
	const storageProvider = helpers.createStorageProvider(dataStorageUrl);

	logger.trace("Constructing Source providers...");
	const sourceOpts = options.sources;
	const sourceProviders = helpers.createSourceProviders(sourceOpts);

	logger.trace("Constructing endpoints...");
	let expressApp: express.Application | null = null; // This is required for http and https only (may be null)

	const endpoints: Array<Initable> = [];
	const endpoint = helpers.getOptsForHttp(options.env);

	try {
		logger.info("Initializing Storage provider...");
		await storageProvider.init();
		destroyHandlers.push(() => storageProvider.dispose());

		logger.trace("Constructing PriceService...");
		const service: PriceService = new PriceService(storageProvider, sourceProviders);

		logger.info("Initializing InfoService...");
		await service.init();

		switch (endpoint.type) {
			case "http":
			case "https": {
				if (expressApp === null) { expressApp = expressAppInit(service, logger); }
				const endpointInstance: HttpEndpoint = new HttpEndpoint(expressApp, endpoint, logger);
				endpoints.push(endpointInstance);
				break;
			}
			default:
				throw new UnreachableEndpointError(endpoint);
		}

		destroyHandlers.push(() => service.dispose());

		logger.info("Initializing endpoints...");
		for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
			const endpointInstance = endpoints[endpointIndex];
			await endpointInstance.init();
			destroyHandlers.push(() => endpointInstance.dispose());
		}
	} catch (e) {
		await destroy();
		throw e;
	}

	logger.info("Initialization completed succefully.");

	const runtime: Runtime = { destroy };

	return runtime;
}

namespace helpers {
	export function createStorageProvider(dataStorageUrl: string): StorageProvider {
		const opts: RedisOptions = helpers.getOptsForRedis(dataStorageUrl);
		const redisStorageProvider = new RedisStorageProvider(opts);
		return redisStorageProvider;
	}
	export function createSourceProviders(options: Sources): Array<SourceProvider> {
		const sourceIds: Array<string> = Object.keys(options);
		const friendlySources: Array<SourceProvider> = [];

		// foreach sourceIds and create object don't implement yet.
		sourceIds.forEach((sourceId) => {
			const sourceOpts = options[sourceId];
			const url = String(sourceOpts.url);
			const parallel = Number(sourceOpts.parallel);
			const perSecond = Number(sourceOpts.perSecond);
			const perMinute = Number(sourceOpts.perMinute);
			const perHour = Number(sourceOpts.perHour);
			const timeout = Number(sourceOpts.timeout);

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

			const provider = new Cryptocompare(url, opts);
			friendlySources.push(provider);
		});

		return friendlySources;
	}

	export function getOptsForRedis(dataStorageUrl: string): RedisOptions {

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
	export function getOptsForHttp(envOpts: OptionsEnv): Configuration.HttpEndpoint | Configuration.HttpsEndpoint {
		if (envOpts.httpEnable === "yes") {
			const opts: Configuration.HttpEndpoint = {
				type: "http",
				listenHost: String(envOpts.httpHost),
				listenPort: Number(envOpts.httpPort)
			};
			return opts;
		}
		if (envOpts.httpsEnable === "yes") {
			if (envOpts.httpsCert === undefined) {
				throw new Error("Do not have settings for httpsCert endpoint");
			}
			if (envOpts.httpsKey === undefined) {
				throw new Error("Do not have settings for httsKey endpoint");
			}
			const opts: Configuration.HttpsEndpoint = {
				type: "https",
				listenHost: String(envOpts.httpsHost),
				listenPort: Number(envOpts.httpsPort),
				caCertificate: String(envOpts.httpsCaCert),
				serviceCertificate: String(envOpts.httpsCert),
				serviceKey: String(envOpts.httpsKey),
				serviceKeyPassword: String(envOpts.httpsKeyPhassPhrase),
				requireClientCertificate: true
			};
			return opts;
		}
		throw new Error("Http(s) endpoint do not enable");
	}
}

export interface ArgumentConfig {
	env: OptionsEnv;
	sources: Sources;
}
interface Sources {
	[source: string]: SourceOpts;
}
interface SourceOpts {
	[key: string]: string | number;
}
interface OptionsEnv {
	[key: string]: Array<string> | string | number | undefined | null;
}

class UnreachableEndpointError extends Error {
	public constructor(endpoint: never) {
		super(`Not supported endpoint: ${JSON.stringify(endpoint)}`);
	}
}
