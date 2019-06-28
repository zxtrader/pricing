import * as zxteam from "@zxteam/contract";
import { Runtime } from "@zxteam/launcher";
import { RestClient } from "@zxteam/restclient";
import * as webserver from "@zxteam/webserver";
import loggerFactory from "@zxteam/logger";
import * as _ from "lodash";

import { URL } from "url";
import { RedisOptions } from "ioredis";
import { Setting } from "./conf";
import { PriceService } from "./PriceService";
import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { Cryptocompare } from "./providers/source/Cryptocompare";
import { RedisStorageProvider } from "./providers/storage/RedisStorageProvider";
import { factory as protocolAdapterFactory } from "./protocol";
import {
	PriceServiceRestEndpoint, PriceServiceWebSocketEndpoint, PriceServiceRouterEndpoint,
	createExpressApplication, setupExpressErrorHandles
} from "./endpoints";

import { Poloniex } from "./providers/source/Poloniex";
import { Binance } from "./providers/source/Binance";

export default async function (opts: Setting.ArgumentConfig): Promise<Runtime> {
	const log = loggerFactory.getLogger("ZXTrader's Historical Price Service");

	// TODO Valdate options

	const destroyHandlers: Array<() => Promise<void>> = [];
	function destroy(): Promise<void> { return destroyHandlers.reverse().reduce((p, c) => p.then(c), Promise.resolve()); }

	const endpoints: Array<zxteam.Initable> = [];

	log.trace("Constructing Storage provider...");
	const dataStorageUrl = opts.storageURL;
	const storageProvider = helpers.createStorageProvider(dataStorageUrl);

	log.trace("Constructing Source providers...");
	const sourceOpts = opts.sources;
	const sourceProviders = helpers.createSourceProviders(sourceOpts);

	const servers = opts.servers.map(function (server) {
		if (webserver.instanceofWebServer(server)) {
			return { name: server.name, server, isOwnInstance: false };
		}
		const ownServerInstance = webserver.createWebServer(server, log);
		ownServerInstance.expressApplication = createExpressApplication(log);
		return { name: ownServerInstance.name, server: ownServerInstance, isOwnInstance: true };
	});
	const serversMap: { readonly [serverName: string]: { server: webserver.WebServer, isOwnInstance: boolean } } = _.keyBy(
		servers,
		"name"
	);

	try {
		log.info("Initializing Storage provider...");
		await storageProvider.init();
		destroyHandlers.push(() => storageProvider.dispose().promise);

		log.trace("Constructing PriceService...");
		const service: PriceService = new PriceService(storageProvider, sourceProviders);

		log.info("Constructing endpoints...");
		for (const endpoint of opts.endpoints) {
			if ("type" in endpoint) {
				switch (endpoint.type) {
					case "rest": {
						const endpointInstance: PriceServiceRestEndpoint = new PriceServiceRestEndpoint(
							servers.filter(s => endpoint.servers.includes(s.name)).map(si => si.server),
							service,
							endpoint,
							log
						);
						endpoints.push(endpointInstance);
						break;
					}
					case "websocket": {
						const protocolAdapter = await protocolAdapterFactory(service, endpoint.protocol, log);
						const endpointInstance: PriceServiceWebSocketEndpoint = new PriceServiceWebSocketEndpoint(
							servers.filter(s => endpoint.servers.includes(s.name)).map(si => si.server),
							endpoint,
							log
						);
						endpointInstance.use(protocolAdapter);
						endpoints.push(endpointInstance);
						break;
					}
					case "express-router": {
						const routerEndpoint: PriceServiceRouterEndpoint = new PriceServiceRouterEndpoint(
							servers.filter(s => endpoint.servers.includes(s.name)).map(si => si.server), service,
							endpoint,
							log
						);
						endpoints.push(routerEndpoint);
						break;
					}
					case "websocket-binder": {
						const protocolAdapter = await protocolAdapterFactory(service, endpoint.protocol, log, endpoint.methodPrefix);
						endpoint.target.use(protocolAdapter);
						break;
					}
					default:
						throw new UnreachableEndpointError(endpoint);
				}
			}
		}

		log.info("Initializing InfoService...");
		await service.init();

		destroyHandlers.push(() => service.dispose().promise);

		log.info("Initializing endpoints...");
		for (let endpointIndex = 0; endpointIndex < endpoints.length; endpointIndex++) {
			const endpointInstance = endpoints[endpointIndex];
			await endpointInstance.init();
			destroyHandlers.push(() => endpointInstance.dispose().promise);
		}

		for (const serverInfo of _.values(serversMap)) {
			if (serverInfo.isOwnInstance === true) {
				if (log.isInfoEnabled) {
					log.info(`Start server: ${serverInfo.server.name}`);
				}
				setupExpressErrorHandles(serverInfo.server.expressApplication, log);
				await serverInfo.server.listen();
				destroyHandlers.push(() => serverInfo.server.dispose().promise);
			}
		}
	} catch (e) {
		await destroy();
		throw e;
	}

	log.info("Initialization completed succefully.");

	const runtime: Runtime = { destroy };

	return runtime;
}

namespace helpers {
	export function createStorageProvider(dataStorageUrl: URL): StorageProvider {
		const opts: RedisOptions = helpers.getOptsForRedis(dataStorageUrl);
		const redisStorageProvider = new RedisStorageProvider(opts);
		return redisStorageProvider;
	}
	export function createSourceProviders(options: Setting.Sources): Array<SourceProvider> {
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
