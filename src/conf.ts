import * as zxteam from "@zxteam/contract";
import * as webserver from "@zxteam/webserver";
import { RestClient } from "@zxteam/restclient";

import { URL } from "url";
import { Router } from "express-serve-static-core";

import { ProtocolType } from "./protocol";

export interface Configuration {
	readonly servers: ReadonlyArray<webserver.Configuration.WebServer | webserver.WebServer>;
	/** Set settings endponts or send new routers */
	readonly endpoints: ReadonlyArray<Configuration.PriceServiceEndpoint>;
	/** Connection URL to database */
	readonly storageURL: URL;
	/** List source system and settings */
	readonly sources: Configuration.Sources;
}

export namespace Configuration {

	export type PriceServiceEndpoint
		= (PriceServiceRestEndpoint & webserver.Configuration.ServerEndpoint)
		| (PriceServiceWebSocketEndpoint & webserver.Configuration.ServerEndpoint)
		| PriceServiceExpressRouterEndpoint
		| PriceServiceWebSocketBinderEndpoint;

	export interface PriceServiceRestEndpoint extends webserver.Configuration.BindEndpoint {
		readonly type: "rest";
		readonly bindPathWeb: string | null;
	}
	export interface PriceServiceWebSocketEndpoint extends webserver.Configuration.WebSocketEndpoint {
		readonly type: "websocket";
	}
	export interface PriceServiceExpressRouterEndpoint extends webserver.Configuration.BindEndpoint {
		readonly type: "express-router";
		readonly router: Router;
	}
	export interface PriceServiceWebSocketBinderEndpoint {
		readonly type: "websocket-binder";
		readonly target: webserver.WebSocketBinderEndpoint;
		readonly methodPrefix?: string;
	}

	export type Endpoint = HttpEndpoint | HttpsEndpoint | ExpressRouterEndpoint;

	export interface HttpEndpoint {
		type: "http";
		listenHost: string;
		listenPort: number;
		/**
		 * See http://expressjs.com/en/4x/api.html#trust.proxy.options.table
		 */
		trustProxy: boolean | "loopback" | "linklocal" | "uniquelocal";
	}
	export interface HttpsEndpoint {
		type: "https";
		listenHost: string;
		listenPort: number;
		/**
		 * See http://expressjs.com/en/4x/api.html#trust.proxy.options.table
		 */
		trustProxy: boolean | "loopback" | "linklocal" | "uniquelocal";
		/**
		 * Certificate's data as Buffer or Path to file
		 */
		caCertificate: Buffer | string;
		/**
		 * Certificate's data as Buffer or Path to file
		 */
		serviceCertificate: Buffer | string;
		/**
		 * Private Key's data as Buffer or Path to file
		 */
		serviceKey: Buffer | string;
		serviceKeyPassword?: string;
		requireClientCertificate: boolean;
	}
	export interface ExpressRouterEndpoint {
		type: "express-router";
		router: Router;
	}

	export interface Sources {
		CRYPTOCOMPARE?: RestClient.Opts;
		POLONIEX?: RestClient.Opts;
		BINANCE?: RestClient.Opts;
		[source: string]: any;
	}
}

export function configurationFactory(configuration: zxteam.Configuration): Configuration {
	const servers: Array<webserver.Configuration.WebServer> = webserver.Configuration.parseWebServers(configuration);
	const sources: Configuration.Sources = helper.parseSources(configuration);

	const endpoints: Array<Configuration.PriceServiceEndpoint> = configuration.getString("endpoints").split(" ").map(
		(endpointIndex: string): Configuration.PriceServiceEndpoint => {
			return helper.parseEndpoint(configuration, endpointIndex);
		}
	);

	const storageURL: URL = helper.parseStorageUrl(configuration);
	const appConfig: Configuration = { servers, endpoints, sources, storageURL };
	return appConfig;
}

export namespace helper {
	export function parseSources(configuration: zxteam.Configuration): Configuration.Sources {
		const sources: Configuration.Sources = {};
		// == Read configuration from config.ini file ==
		const sourceIds: Array<string> = configuration.getString("sources").split(" ");
		for (let i = 0; i < sourceIds.length; i++) {
			const sourceId = sourceIds[i];
			const parallel = configuration.getInteger(`source.${sourceId}.limit.parallel`);
			const perSecond = configuration.getInteger(`source.${sourceId}.limit.perSecond`);
			const perMinute = configuration.getInteger(`source.${sourceId}.limit.perMinute`);
			const perHour = configuration.getInteger(`source.${sourceId}.limit.perHour`);
			const timeout = configuration.getInteger(`source.${sourceId}.timeout`);

			sources[sourceId] = {
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
		}
		return sources;
	}
	export function parseEndpoint(configuration: zxteam.Configuration, endpointIndex: string): Configuration.PriceServiceEndpoint {
		const endpointConfiguration: zxteam.Configuration = configuration.getConfiguration(`endpoint.${endpointIndex}`);
		const endpointType = endpointConfiguration.getString("type");
		switch (endpointType) {
			case "rest": {
				const httpEndpoint: Configuration.PriceServiceRestEndpoint & webserver.Configuration.ServerEndpoint = {
					type: "rest",
					servers: endpointConfiguration.getString("servers").split(" "),
					bindPath: endpointConfiguration.getString("bindPath", "/"),
					bindPathWeb: endpointConfiguration.hasKey("bindPathWeb") ? endpointConfiguration.getString("bindPathWeb") : null
				};
				return httpEndpoint;
			}
			case "websocket": {
				const webSocketEndpoint: Configuration.PriceServiceWebSocketEndpoint & webserver.Configuration.ServerEndpoint = {
					type: "websocket",
					servers: endpointConfiguration.getString("servers").split(" "),
					bindPath: endpointConfiguration.getString("bindPath", "/"),
					defaultProtocol: ProtocolType.JSONRPC
				};
				return webSocketEndpoint;
			}
			default:
				throw new Error(`Non supported endpont type: ${endpointType}`);
		}
	}
	export function parseTrustProxy(val: string): boolean | "loopback" | "linklocal" | "uniquelocal" {
		switch (val) {
			case "true": return true;
			case "false": return false;
			case "loopback":
			case "linklocal":
			case "uniquelocal":
				return val;
			default:
				throw new Error(`Wrong value for trustProxy: ${val}`);
		}
	}
	export function parseStorageUrl(configuration: zxteam.Configuration): URL {
		const dataStorageUrl: string = configuration.getString("dataStorageURL");
		return new URL(dataStorageUrl);
	}
}
