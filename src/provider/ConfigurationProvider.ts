import { Configuration as HostingConfiguration, WebServer } from "@zxteam/hosting";
import { Singleton, Provides } from "@zxteam/launcher";

import { Configuration } from "../Configuration";

@Singleton
export abstract class ConfigurationProvider implements Configuration {
	abstract get servers(): ReadonlyArray<HostingConfiguration.WebServer | WebServer>;
	abstract get endpoints(): ReadonlyArray<Configuration.Endpoint>;
	abstract get storageURL(): URL;
	abstract get coingetRecorderStreamRedisURL(): URL;
	abstract get sources(): Configuration.Sources;
	abstract get aggregatedPriceSourceName(): string;
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

	public get servers(): ReadonlyArray<HostingConfiguration.WebServer | WebServer> { return this._configuration.servers; }
	public get endpoints(): ReadonlyArray<Configuration.Endpoint> { return this._configuration.endpoints; }
	public get storageURL(): URL { return this._configuration.storageURL; }
	public get coingetRecorderStreamRedisURL(): URL { return this._configuration.coingetRecorderStreamRedisURL; }
	public get sources(): Configuration.Sources { return this._configuration.sources; }
	public get aggregatedPriceSourceName(): string { return this._configuration.aggregatedPriceSourceName; }
}
