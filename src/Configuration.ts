import { Configuration as RawConfiguration, CancellationToken } from "@zxteam/contract";
import {
	envConfiguration, fileConfiguration,
	chainConfiguration, secretsDirectoryConfiguration
} from "@zxteam/configuration";
import { InnerError } from "@zxteam/errors";
import { Configuration as HostingConfiguration, WebServer } from "@zxteam/hosting";
import { HttpClient } from "@zxteam/http-client";
import { LaunchError } from "@zxteam/launcher";



import * as _ from "lodash";
import { Router } from "express-serve-static-core";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";

const exists = util.promisify(fs.exists);

export interface Configuration {
	readonly servers: ReadonlyArray<HostingConfiguration.WebServer | WebServer>;
	/** Set settings endponts or send new routers */
	readonly endpoints: ReadonlyArray<Configuration.Endpoint>;
	/** Connection URL to database */
	readonly storageURL: URL;
	/** List source system and settings */
	readonly sources: Configuration.Sources;
}

export namespace Configuration {
	export type Endpoint = RestEndpoint | WebSocketEndpoint;

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

}

export async function configurationFactory(cancellationToken: CancellationToken): Promise<Configuration> {
	let configFileArg = process.argv.find(w => w.startsWith("--config="));

	if (process.env.NODE_ENV === "development" && configFileArg === undefined) {
		const defaultConfigFile: string = path.normalize(path.join(__dirname, "..", "cpservice.config"));
		if (await exists(defaultConfigFile)) {
			console.warn(`An argument --config is not passed. In development mode we using default configuration file: ${defaultConfigFile}`);
			configFileArg = `--config=${defaultConfigFile}`;
		}
	}

	if (configFileArg === undefined) {
		throw new LaunchError("An argument --config is not passed");
	}

	const secretsDirArg = process.argv.find(w => w.startsWith("--secrets-dir="));

	const chainItems: Array<RawConfiguration> = [];

	const envConf = envConfiguration();
	chainItems.push(envConf);

	if (secretsDirArg !== undefined) {
		const secretsDir = secretsDirArg.substring(14); // Cut --secrets-dir=
		const secretsConfiguration = await secretsDirectoryConfiguration(secretsDir);
		chainItems.push(secretsConfiguration);
	}

	const configFile = configFileArg.substring(9); // Cut --config=
	if (process.env.NODE_ENV === "development") {
		const configFileDir = path.dirname(configFile);
		const configFileExtension = path.extname(configFile);
		const configFileName = path.basename(configFile, configFileExtension);
		const develConfigFile = path.join(configFileDir, `${configFileName}-dev${configFileExtension}`);
		if (await exists(develConfigFile)) {
			const develFileConf = fileConfiguration(develConfigFile);
			chainItems.push(develFileConf);
		}
		cancellationToken.throwIfCancellationRequested();
	}
	const fileConf = fileConfiguration(configFile);
	chainItems.push(fileConf);

	const appConfiguration = parseConfiguration(
		chainConfiguration(...chainItems)
	);

	return appConfiguration;
}

export class ConfigurationError extends InnerError { }

//  ___           _                                   _
// |_ _|  _ __   | |_    ___   _ __   _ __     __ _  | |
//  | |  | '_ \  | __|  / _ \ | '__| | '_ \   / _` | | |
//  | |  | | | | | |_  |  __/ | |    | | | | | (_| | | |
// |___| |_| |_|  \__|  \___| |_|    |_| |_|  \__,_| |_|


function parseConfiguration(configuration: RawConfiguration): Configuration {
	const servers: Array<HostingConfiguration.WebServer> = HostingConfiguration.parseWebServers(configuration);
	const sources: Configuration.Sources = Configuration.parseSources(configuration);

	const endpoints: Array<Configuration.Endpoint> = configuration.getString("endpoints").split(" ").map(
		(endpointIndex: string): Configuration.Endpoint => {
			return Configuration.parseEndpoint(configuration, endpointIndex);
		}
	);

	const storageURL: URL = configuration.getURL("dataStorageURL");
	const appConfig: Configuration = Object.freeze({ servers, endpoints, sources, storageURL });
	return appConfig;
}

