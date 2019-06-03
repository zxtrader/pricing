import { URL } from "url";
import * as express from "express";
import { RedisOptions } from "ioredis";
import { Configuration } from "./conf";
import { PriceService } from "./PriceService";
import { loggerManager } from "@zxteam/logger";
import { RestClient } from "@zxteam/restclient";
import { Runtime } from "@zxteam/launcher";
import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { Cryptocompare } from "./providers/source/Cryptocompare";
import { HttpEndpoint, expressAppInit, routeAppInit } from "./endpoints/HttpEndpoint";
import { RedisStorageProvider } from "./providers/storage/RedisStorageProvider";
import { Initable } from "@zxteam/disposable";
import { Poloniex } from "./providers/source/Poloniex";
import { Binance } from "./providers/source/Binance";

export default async function (options: ArgumentConfig): Promise<Runtime> {

	// Validate options

	const logger = loggerManager.getLogger("App");

	const destroyHandlers: Array<() => Promise<void>> = [];
	function destroy(): Promise<void> { return destroyHandlers.reverse().reduce((p, c) => p.then(c), Promise.resolve()); }

	logger.trace("Constructing Storage provider...");
	const dataStorageUrl = String(options.storage);
	const storageProvider = helpers.createStorageProvider(dataStorageUrl);

	logger.trace("Constructing Source providers...");
	const sourceOpts = options.sources;
	const sourceProviders = helpers.createSourceProviders(sourceOpts);

	logger.trace("Constructing endpoints...");
	let expressApp: express.Application | null = null; // This is required for http and https only (may be null)

	const endpoints: Array<Initable> = [];

	try {
		logger.info("Initializing Storage provider...");
		await storageProvider.init();
		destroyHandlers.push(() => storageProvider.dispose().promise);

		logger.trace("Constructing PriceService...");
		const service: PriceService = new PriceService(storageProvider, sourceProviders);

		logger.info("Initializing InfoService...");
		await service.init();

		options.endpoints.forEach((endpoint: Configuration.Endpoint | express.Router) => {
			if ("type" in endpoint) {
				switch (endpoint.type) {
					case "http":
					case "https": {
						if (expressApp === null) {
							expressApp = expressAppInit(service, logger);
						}
						const endpointInstance: HttpEndpoint = new HttpEndpoint(expressApp, endpoint, logger);
						endpoints.push(endpointInstance);
						break;
					}
					default:
						throw new UnreachableEndpointError(endpoint);
				}
			} else if ("name" in endpoint) {
				routeAppInit(service, endpoint);
			} else {
				throw new UnreachableEndpointError(endpoint);
			}
		});

		destroyHandlers.push(() => service.dispose().promise);

		logger.info("Initializing endpoints...");
		for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
			const endpointInstance = endpoints[endpointIndex];
			await endpointInstance.init();
			destroyHandlers.push(() => endpointInstance.dispose().promise);
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
		const friendlySources: Array<any> = [];

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

			let provider;
			switch (sourceId) {
				case "cryptocompare":
					provider = new Cryptocompare(url, opts);
					break;
				case "poloniex": {
					provider = new Poloniex(url, opts);
					break;
				}
				case "binance": {
					provider = new Binance(url, opts);
					break;
				}
				default:
					throw new UnreachableSourceError(sourceId);
			}

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
}

export interface ArgumentConfig {
	endpoints: Array<Configuration.Endpoint | express.Router>;
	storage: string; // Connection URL to database
	sources: Sources; // List source system
	opts: OptionsEnv; // { Key: value } Other settings limit params, etc...
}
interface Sources {
	[source: string]: SourceOpts;
}
interface SourceOpts {
	[key: string]: string | number;
}
export interface OptionsEnv {
	[key: string]: Array<string> | string | number | undefined | null;
}

class UnreachableEndpointError extends Error {
	public constructor(endpoint: never) {
		super(`Not supported endpoint: ${JSON.stringify(endpoint)}`);
	}
}
class UnreachableSourceError extends Error {
	public constructor(endpoint: string) {
		super(`Not supported source system: ${endpoint}`);
	}
}
