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
	const dataStorageUrl = options.storageURL;
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
	export function createStorageProvider(dataStorageUrl: URL): StorageProvider {
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

			const opts: RestClient.Opts = sourceOpts;

			let provider;
			switch (sourceId) {
				case "CRYPTOCOMPARE":
					provider = new Cryptocompare(opts);
					break;
				case "POLONIEX": {
					provider = new Poloniex(opts);
					break;
				}
				case "BINANCE": {
					provider = new Binance(opts);
					break;
				}
				default:
					throw new UnreachableSourceError(sourceId);
			}

			friendlySources.push(provider);
		});

		return friendlySources;
	}
	export function getOptsForRedis(dataStorageUrl: URL): RedisOptions {

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

		const optsForRedis: RedisOptions = praseToOptsRedis(dataStorageUrl);

		return optsForRedis;
	}
}

export interface ArgumentConfig {
	/** Set settings endponts or send new routers */
	endpoints: Array<Configuration.Endpoint | express.Router>;
	/** Connection URL to database */
	storageURL: URL;
	/** List source system and settings */
	sources: Sources;
	/** { Key: value } Other settings limit params, etc... */
	opts: OptionsEnv;
}

export type Sources = SourcesDefault & SourcesAny;
interface SourcesDefault {
	CRYPTOCOMPARE?: RestClient.Opts;
	POLONIEX?: RestClient.Opts;
	BINANCE?: RestClient.Opts;
}
interface SourcesAny {
	[source: string]: any;
}

export interface OptionsEnv {
	/**
	 * Demand - prices are cached only at the user's request
	 * Sync - service automatically copies all required prices
	 */
	priceMode: PriceMode;
}

export declare const enum PriceMode { DEMAND = "DEMAND", SYNC = "SYNC" }

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
