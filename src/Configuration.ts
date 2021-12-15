import { Configuration as RawConfiguration, CancellationToken } from "@zxteam/contract";
import { InnerError, wrapErrorIfNeeded } from "@zxteam/errors";
import { Configuration as HostingConfiguration, WebServer } from "@zxteam/hosting";
import { HttpClient } from "@zxteam/http-client";

import * as _ from "lodash";

export interface Configuration {
	readonly servers: ReadonlyArray<HostingConfiguration.WebServer | Configuration.GrpcServer>;
	/** Set settings endponts or send new routers */
	readonly endpoints: ReadonlyArray<Configuration.Endpoint>;
	/** Connection URL to database */
	readonly storageURL: URL;
	readonly coingetRecorderStreamRedisURL: URL;
	/** List source system and settings */
	readonly sources: Configuration.Sources;
	readonly aggregatedPriceSourceName: string;
}

export namespace Configuration {
	export type Endpoint = RestEndpoint | WebSocketEndpoint;

	export interface GrpcServer {
		readonly type: "grpc";
		readonly name: string;
		readonly listenHost: string;
		readonly listenPort: number;
	}

	export interface RestEndpoint extends HostingConfiguration.BindEndpoint, HostingConfiguration.ServerEndpoint {
		readonly type: "rest";
	}
	export interface WebSocketEndpoint extends HostingConfiguration.WebSocketEndpoint, HostingConfiguration.ServerEndpoint {
		readonly type: "websocket";
	}

	export interface Sources {
		CRYPTOCOMPARE?: HttpClient.Opts;
		// POLONIEX?: WebClient.Opts;
		// BINANCE?: WebClient.Opts;
		[source: string]: any;
	}

	export function parseEndpoint(configuration: RawConfiguration, endpointIndex: string): Configuration.Endpoint {
		const endpointConfiguration: RawConfiguration = configuration.getConfiguration(`endpoint.${endpointIndex}`);
		const endpointType = endpointConfiguration.getString("type");
		switch (endpointType) {
			case "rest": {
				const httpEndpoint: Configuration.RestEndpoint = {
					type: "rest",
					servers: endpointConfiguration.getString("servers").split(" "),
					bindPath: endpointConfiguration.getString("bindPath", "/")
					//bindPathWeb: endpointConfiguration.has("bindPathWeb") ? endpointConfiguration.getString("bindPathWeb") : null
				};
				return httpEndpoint;
			}
			case "websocket": {
				const webSocketEndpoint: Configuration.WebSocketEndpoint = {
					type: "websocket",
					servers: endpointConfiguration.getString("servers").split(" "),
					bindPath: endpointConfiguration.getString("bindPath", "/"),
					defaultProtocol: "jsonrpc"
				};
				return webSocketEndpoint;
			}
			default:
				throw new Error(`Non supported endpont type: ${endpointType}`);
		}
	}

	export function parseSources(configuration: RawConfiguration): Configuration.Sources {
		const sources: Configuration.Sources = {};
		const sourceIds: ReadonlyArray<string> = configuration.getString("sources").split(" ");
		for (const sourceId of sourceIds) {
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

	export function parse(configuration: RawConfiguration): Configuration {
		try {
			const servers: Array<HostingConfiguration.WebServer> = HostingConfiguration.parseWebServers(configuration);
			const sources: Configuration.Sources = Configuration.parseSources(configuration);

			const endpoints: Array<Configuration.Endpoint> = configuration.getString("endpoints").split(" ").map(
				(endpointIndex: string): Configuration.Endpoint => {
					return Configuration.parseEndpoint(configuration, endpointIndex);
				}
			);

			const aggregatedPriceSourceName: string = configuration.getString("aggregatedPriceSourceName", "ZXTRADER");

			const storageURL: URL = configuration.getURL("dataStorageURL");
			const coingetRecorderStreamRedisURL: URL = configuration.getURL("coingetRecorderStreamRedisURL");
			const appConfig: Configuration = Object.freeze({
				servers, endpoints, sources, storageURL,
				coingetRecorderStreamRedisURL, aggregatedPriceSourceName
			});
			return appConfig;
		} catch (e) {
			const err: Error = wrapErrorIfNeeded(e);
			throw new ConfigurationError(err.message, err);
		}
	}

}

export class ConfigurationError extends InnerError { }

//  ___           _                                   _
// |_ _|  _ __   | |_    ___   _ __   _ __     __ _  | |
//  | |  | '_ \  | __|  / _ \ | '__| | '_ \   / _` | | |
//  | |  | | | | | |_  |  __/ | |    | | | | | (_| | | |
// |___| |_| |_|  \__|  \___| |_|    |_| |_|  \__,_| |_|

