import { Configuration as HostingConfiguration, WebServer } from "@zxteam/hosting";
import HttpClient from "@zxteam/http-client";
import { Singleton, Provides } from "@zxteam/launcher";

import { Configuration } from "../Configuration";

export interface SSL {
	readonly caCert?: Buffer;
	readonly clientCert?: {
		readonly cert: Buffer;
		readonly key: Buffer;
	};
}
export namespace SSL {
	export function toHttpClientSslOpts(configurationSsl: SSL | undefined | null): HttpClient.SslOpts | null {
		if (configurationSsl === null) { return null; }
		if (configurationSsl === undefined) { return null; }

		if (configurationSsl.caCert !== undefined) {
			if (configurationSsl.clientCert !== undefined) {
				return Object.freeze({
					ca: configurationSsl.caCert,
					cert: configurationSsl.clientCert.cert,
					key: configurationSsl.clientCert.key
				});
			} else {
				return Object.freeze({
					ca: configurationSsl.caCert
				});
			}
		} else {
			if (configurationSsl.clientCert !== undefined) {
				return Object.freeze({
					cert: configurationSsl.clientCert.cert,
					key: configurationSsl.clientCert.key
				});
			}
		}

		return null;
	}
}
export interface PostresqlConnection {
	readonly url: URL;
	readonly ssl: SSL | null;
}
@Singleton
export abstract class ConfigurationProvider implements Configuration {
	abstract get servers(): ReadonlyArray<HostingConfiguration.WebServer | Configuration.GrpcServer>;
	abstract get endpoints(): ReadonlyArray<Configuration.Endpoint>;
	abstract get storageURL(): URL;
	abstract get coingetRecorderStreamRedisURL(): URL;
	abstract get sources(): Configuration.Sources;
	abstract get sourcesPriorityQueue(): ReadonlyArray<string>;
	abstract get aggregatedPriceSourceName(): string;
	abstract get postgresDbUrl(): PostresqlConnection;
}

@Provides(ConfigurationProvider)
/**
 * The class implements DI Provider + Configuration Adapter
 */
export class ConfigurationProviderImpl extends ConfigurationProvider {
	private _configuration: Configuration;

	public constructor(configuration: Configuration) {
		super();
		this._configuration = configuration;
	}

	public get servers(): ReadonlyArray<HostingConfiguration.WebServer | Configuration.GrpcServer> { return this._configuration.servers; }
	public get endpoints(): ReadonlyArray<Configuration.Endpoint> { return this._configuration.endpoints; }
	public get storageURL(): URL { return this._configuration.storageURL; }
	public get coingetRecorderStreamRedisURL(): URL { return this._configuration.coingetRecorderStreamRedisURL; }
	public get sources(): Configuration.Sources { return this._configuration.sources; }
	public get sourcesPriorityQueue(): ReadonlyArray<string> { return this._configuration.sourcesPriorityQueue; }
	public get aggregatedPriceSourceName(): string { return this._configuration.aggregatedPriceSourceName; }
	public get postgresDbUrl(): PostresqlConnection { return this._configuration.postgresDbUrl; }
}
