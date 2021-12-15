import { Logger, CancellationToken } from "@zxteam/contract";
import { Initable } from "@zxteam/disposable";
import { Container, Provides, Singleton } from "@zxteam/launcher";
import { logger } from "@zxteam/logger";
import * as hosting from "@zxteam/hosting";

import * as _ from "lodash";

import { ConfigurationError } from "../Configuration";

import { ConfigurationProvider } from "./ConfigurationProvider";
import { HostingProvider } from "./HostingProvider";

import { RestEndpoint } from "../endpoint/RestEndpoint";
import { WebSocketEndpoint } from "../endpoint/WebSocketEndpoint";
import { ApiProvider } from "./ApiProvider";
import { InvalidOperationError } from "@zxteam/errors";

@Singleton
export abstract class EndpointsProvider extends Initable {
	protected readonly log: Logger;

	public constructor() {
		super();
		this.log = logger.getLogger("Endpoints");
	}
}

@Provides(EndpointsProvider)
export class EndpointsProviderImpl extends EndpointsProvider {
	// Do not use Inject inside providers to prevents circular dependency
	private readonly _apiProvider: ApiProvider;
	private readonly _hostingProvider: HostingProvider;
	private readonly _config: ConfigurationProvider;

	private readonly _endpointInstances: Array<Initable>;
	private readonly _destroyHandlers: Array<() => Promise<void>>;


	public constructor() {
		super();

		this.log.info("Constructing endpoints...");

		this._apiProvider = Container.get(ApiProvider);
		this._hostingProvider = Container.get(HostingProvider);
		this._config = Container.get(ConfigurationProvider);

		this._endpointInstances = [];

		const serversMap: Map<HostingProvider.ServerInstance["name"], HostingProvider.ServerInstance> = new Map();
		this._hostingProvider.serverInstances.forEach(s => serversMap.set(s.name, s));
		this._hostingProvider.serverInstances.forEach(s => serversMap.set(s.name, s));

		for (const endpoint of this._config.endpoints) {
			const webServers: Array<hosting.WebServer> = [];
			//const grpcServers: Array<GrpcServer> = [];
			for (const bindServer of endpoint.servers) {
				const serverInstance: HostingProvider.ServerInstance | undefined = serversMap.get(bindServer);
				if (serverInstance === undefined) {
					throw new ConfigurationError(`Cannot bind an endpoint '${endpoint.type}' to a server '${bindServer}'. The server is not defined.`);
				}
				switch (serverInstance.type) {
					case "grpc":
						// grpcServers.push(serverInstance.grpcServer);
						// break;
						throw new InvalidOperationError("Not supported yet");
					case "http":
					case "https":
						webServers.push(serverInstance.webServer);
						break;
					default:
						throw new InvalidOperationError();
				}
			}

			const endpointLogger: Logger = this.log.getLogger(
				endpoint.type +
				("bindPath" in endpoint ? "(" + endpoint.bindPath + ")" : "")
			);

			switch (endpoint.type) {
				case "rest": {
					const endpointInstance: RestEndpoint = new RestEndpoint(
						this._apiProvider.price, webServers, endpoint,
						this.log.getLogger(endpoint.type + "(" + endpoint.bindPath + ")")
					);
					this._endpointInstances.push(endpointInstance);
					break;
				}
				case "websocket": {
					const endpointInstance: WebSocketEndpoint = new WebSocketEndpoint(
						this._apiProvider.price, webServers, endpoint,
						this.log.getLogger(endpoint.type + "(" + endpoint.bindPath + ")")
					);
					this._endpointInstances.push(endpointInstance);
					break;
				}
				default:
					throw new UnreachableEndpointError(endpoint);
			}
		}

		this._destroyHandlers = [];
	}

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		this.log.info("Initializing endpoints...");
		try {
			for (const endpointInstance of this._endpointInstances) {
				await endpointInstance.init(cancellationToken);
				this._destroyHandlers.push(() => endpointInstance.dispose());
			}
		} catch (e) {
			let destroyHandler;
			while ((destroyHandler = this._destroyHandlers.pop()) !== undefined) {
				await destroyHandler();
			}
			throw e;
		}
	}

	protected async onDispose(): Promise<void> {
		this.log.info("Destroying endpoints...");
		let destroyHandler;
		while ((destroyHandler = this._destroyHandlers.pop()) !== undefined) {
			await destroyHandler();
		}
	}
}

class UnreachableEndpointError extends Error {
	public constructor(endpoint: never) {
		super(`Not supported endpoint: ${JSON.stringify(endpoint)}`);
	}
}
