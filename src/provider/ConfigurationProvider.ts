import { CancellationToken } from "@zxteam/contract";
import { Initable } from "@zxteam/disposable";
import { InvalidOperationError } from "@zxteam/errors";
import { Configuration as HostingConfiguration, WebServer } from "@zxteam/hosting";
import { Singleton, Provides } from "@zxteam/launcher";

import { Configuration, configurationFactory } from "../Configuration";

@Singleton
export abstract class ConfigurationProvider extends Initable implements Configuration {
	abstract get servers(): ReadonlyArray<HostingConfiguration.WebServer | WebServer>;
	abstract get endpoints(): ReadonlyArray<Configuration.Endpoint>;
	abstract get storageURL(): URL;
	abstract get sources(): Configuration.Sources;
	abstract get aggregatedPriceSourceName(): string;
}

@Provides(ConfigurationProvider)
/**
 * The class implements DI Provider + Configuration Adapter
 */
export class ConfigurationProviderImpl extends ConfigurationProvider {
	private __configuration: Configuration | null;

	public constructor() {
		super();
		this.__configuration = null;
	}

	public get servers(): ReadonlyArray<HostingConfiguration.WebServer | WebServer> { return this._configuration.servers; }
	public get endpoints(): ReadonlyArray<Configuration.Endpoint> { return this._configuration.endpoints; }
	public get storageURL(): URL { return this._configuration.storageURL; }
	public get sources(): Configuration.Sources { return this._configuration.sources; }
	public get aggregatedPriceSourceName(): string { return this._configuration.aggregatedPriceSourceName; }

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		this.__configuration = await configurationFactory(cancellationToken);
	}

	protected onDispose() {
		// Nothing to dispose
	}

	protected get _configuration(): Configuration {
		if (this.__configuration === null) {
			throw new InvalidOperationError("Wrong operation at current state. Did you init()?");
		}
		return this.__configuration;
	}
}
