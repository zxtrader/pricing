import * as zxteam from "@zxteam/contract";
import { Runtime } from "@zxteam/launcher";
import { RestClient } from "@zxteam/restclient";
import * as webserver from "@zxteam/webserver";
import loggerFactory from "@zxteam/logger";

import { URL } from "url";
import * as _ from "lodash";

import { Configuration } from "./conf";
import { PriceService } from "./PriceService";
import { SourceProvider } from "./providers/source/contract";
import { StorageProvider } from "./providers/storage/contract";
import { Cryptocompare } from "./providers/source/Cryptocompare";
import { RedisStorageProvider } from "./providers/storage/RedisStorageProvider";

import { factory as protocolAdapterFactory, ProtocolType, ProtocolTypes } from "./protocol";
import {
	PriceServiceRestEndpoint, PriceServiceWebSocketEndpoint, PriceServiceRouterEndpoint,
	createExpressApplication, setupExpressErrorHandles
} from "./endpoints";

import { Poloniex } from "./providers/source/Poloniex";
import { Binance } from "./providers/source/Binance";

export { protocolAdapterFactory, ProtocolType, ProtocolTypes };
export * from "./conf";

export default async function (opts: Configuration): Promise<Runtime> {
	const log = loggerFactory.getLogger("ZXTrader's Historical Price Service");

	// TODO Valdate options

	const destroyHandlers: Array<() => Promise<void>> = [];
	function destroy(): Promise<void> { return destroyHandlers.reverse().reduce((p, c) => p.then(c), Promise.resolve()); }

	log.trace("Constructing Source providers...");
	const sourceOpts = opts.sources;
	const sourceProviders = helpers.createSourceProviders(sourceOpts);

	const serverInstances = opts.servers.map(function (server) {
		if (webserver.instanceofWebServer(server)) {
			return { name: server.name, server, isOwnInstance: false };
		}
		const ownServerInstance = webserver.createWebServer(server, log);
		ownServerInstance.rootExpressApplication = createExpressApplication(log);
		return { name: ownServerInstance.name, server: ownServerInstance, isOwnInstance: true };
	});
	const serversMap: { readonly [serverName: string]: { server: webserver.WebServer, isOwnInstance: boolean } } = _.keyBy(
		serverInstances,
		"name"
	);

	try {
		log.trace("Constructing Storage provider...");
		const dataStorageUrl = opts.storageURL;
		const storageProvider = helpers.createStorageProvider(dataStorageUrl);

		log.trace("Constructing PriceService...");
		const service: PriceService = new PriceService(storageProvider, sourceProviders);

		log.info("Constructing endpoints...");
		const endpointInstances: Array<zxteam.Initable> = [];
		for (const endpoint of opts.endpoints) {
			if ("type" in endpoint) {
				switch (endpoint.type) {
					case "rest": {
						const endpointInstance: PriceServiceRestEndpoint = new PriceServiceRestEndpoint(
							serverInstances.filter(s => endpoint.servers.includes(s.name)).map(si => si.server),
							service,
							endpoint,
							log
						);
						endpointInstances.push(endpointInstance);
						break;
					}
					case "websocket": {
						const endpointInstance = new PriceServiceWebSocketEndpoint(
							serverInstances.filter(s => endpoint.servers.includes(s.name)).map(si => si.server),
							endpoint,
							loggerFactory.getLogger("Endpoint:" + endpoint.type + "(" + endpoint.bindPath + ")")
						);

						// Registering protocols
						for (const protocol of ProtocolTypes) {
							const protocolAdapter = await protocolAdapterFactory(service, protocol,
								loggerFactory.getLogger(
									"Endpoint:" + endpoint.type + "(" + endpoint.bindPath + "):Protocol(" + protocol + ")"
								)
							);
							endpointInstance.use(protocol, protocolAdapter);
						}

						endpointInstances.push(endpointInstance);
						break;
					}
					case "express-router": {
						const routerEndpoint: PriceServiceRouterEndpoint = new PriceServiceRouterEndpoint(
							service,
							endpoint,
							log
						);
						endpointInstances.push(routerEndpoint);
						break;
					}
					case "websocket-binder": {
						const targetEndpoint: webserver.WebSocketBinderEndpoint = endpoint.target;
						for (const protocol of ProtocolTypes) {
							// Registering protocols
							const protocolAdapter = await protocolAdapterFactory(service, protocol,
								loggerFactory.getLogger("Endpoint:" + endpoint.type + "(" + protocol + ")"),
								endpoint.methodPrefix
							);
							targetEndpoint.use(protocol, protocolAdapter);
						}
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
		for (let endpointIndex = 0; endpointIndex < endpointInstances.length; endpointIndex++) {
			const endpointInstance = endpointInstances[endpointIndex];
			await endpointInstance.init();
			destroyHandlers.push(() => endpointInstance.dispose().promise);
		}

		for (const serverInfo of _.values(serversMap)) {
			if (serverInfo.isOwnInstance === true) {
				if (log.isInfoEnabled) {
					log.info(`Start server: ${serverInfo.server.name}`);
				}
				setupExpressErrorHandles(serverInfo.server.rootExpressApplication, log);
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
		const { protocol } = dataStorageUrl;
		switch (protocol) {
			case "redis:":
				return new RedisStorageProvider(dataStorageUrl);
			default:
				throw new Error(`Unsupported Storage Provider protocol: ${protocol}`);
		}
	}
	export function createSourceProviders(options: Configuration.Sources): Array<SourceProvider> {
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
