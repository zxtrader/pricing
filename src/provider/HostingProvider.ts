import { Initable } from "@zxteam/disposable";
import { Container, Provides, Singleton } from "@zxteam/launcher";
import { logger } from "@zxteam/logger";
import * as hosting from "@zxteam/hosting";

import * as express from "express";
import * as _ from "lodash";

import { ConfigurationProvider } from "./ConfigurationProvider";
import { Logger, CancellationToken } from "@zxteam/contract";
import { InvalidOperationError } from "@zxteam/errors";

@Singleton
export abstract class HostingProvider extends Initable {
	public abstract get serverInstances(): ReadonlyArray<HostingProvider.ServerInstance>;

	protected readonly _log: Logger;

	public constructor() {
		super();
		this._log = logger.getLogger("Hosting");
	}

	public abstract finalizeConfiguration(): void;
}
export namespace HostingProvider {
	export interface WebServerInstance {
		readonly type: "http" | "https";
		readonly name: string;
		readonly webServer: hosting.WebServer;
	}
	export interface GrpcServerInstance {
		readonly type: "grpc";
		readonly name: string;
		readonly grpcServer: any/*GrpcServer*/;
	}
	export type ServerInstance = WebServerInstance | GrpcServerInstance;
}

@Provides(HostingProvider)
class HostingProviderImpl extends HostingProvider {
	// Do not use Inject inside providers to prevents circular dependency
	private readonly _config: ConfigurationProvider;

	private readonly _serverInstances: Array<
	{ type: "http" | "https"; name: string, webServer: hosting.WebServer }
// | { type: "grpc"; name: string; grpcServer: GrpcServer; }
>;
	private readonly _destroyHandlers: Array<() => Promise<void>>;
	private _isConfigured: boolean;

	public constructor() {
		super();

		this._config = Container.get(ConfigurationProvider);

		this._log.info("Constructing Web servers...");
		this._serverInstances = this._config.servers.map((serverOpts) => {
			const serverLog: Logger = this._log.getLogger(`[${serverOpts.name}]`);
			switch (serverOpts.type) {
				case "http":
				case "https": {
					const serverInstance = hosting.createWebServer(serverOpts, serverLog);
					return Object.freeze({ type: serverOpts.type, name: serverInstance.name, webServer: serverInstance });
				}
				case "grpc": {
					// 	const serverInstance = new GrpcServer(serverOpts, serverLog);
					// 	return Object.freeze({ type: serverOpts.type, name: serverInstance.name, grpcServer: serverInstance });
					throw new InvalidOperationError("Not supported yet");
				}
				default:
					throw new UnreachableNotSupportedServer(serverOpts);
			}
		});
		this._destroyHandlers = [];
		this._isConfigured = false;
	}

	public get serverInstances(): ReadonlyArray<HostingProvider.ServerInstance> {
		return Object.freeze(this._serverInstances);
	}

	public finalizeConfiguration(): void {
		for (const serverInstance of _.values(this._serverInstances)) {
			if (serverInstance.type === "http" || serverInstance.type === "https") {
				setupExpressErrorHandles(serverInstance.webServer.rootExpressApplication, this._log);
			}
		}
		this._isConfigured = true;
	}

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		this._log.info("Initializing Web servers...");

		const serversMap: {
			readonly [serverName: string]: HostingProvider.ServerInstance
		} = _.keyBy(this._serverInstances, "name");

		try {
			for (const serverInstance of _.values(serversMap)) {
				if (this._log.isInfoEnabled) {
					this._log.info(`Start server: ${serverInstance.name}`);
				}

				if (serverInstance.type === "http" || serverInstance.type === "https") {
					const expressApplication = serverInstance.webServer.rootExpressApplication;
					expressApplication.enable("case sensitive routing"); // "/Foo" and "/foo" should be different routes
					expressApplication.enable("strict routing"); // the router should treat "/foo" and "/foo/" as different.

					if (!("NODE_ENV" in process.env) || process.env.NODE_ENV === "production") {
						expressApplication.set("env", "production"); // by default use production mode
						expressApplication.disable("x-powered-by"); // Hide real www server (security reason)
					} else {
						expressApplication.set("json spaces", 4);
					}

					expressApplication.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
						if (this._isConfigured !== true) {
							return res.writeHead(503, "Service temporary unavailable. Please wait. Launching...").end();
						} else {
							next();
						}
					});

					await serverInstance.webServer.init(cancellationToken);
					this._destroyHandlers.push(() => serverInstance.webServer.dispose().catch(console.error));
					// } else if (serverInstance.type === "grpc") {
					// 	await serverInstance.grpcServer.init(cancellationToken);
					// 	this._destroyHandlers.push(() => serverInstance.grpcServer.dispose().catch(console.error));
				} else {
					throw new InvalidOperationError();
				}
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
		this._log.info("Disposinig Web servers...");
		let destroyHandler;
		while ((destroyHandler = this._destroyHandlers.pop()) !== undefined) {
			await destroyHandler();
		}
	}
}



export function setupExpressErrorHandles(app: express.Application, log: Logger): void {
	// 404 Not found (bad URL)
	app.use(function (req: express.Request, res: express.Response) { res.status(404).end("404 Not Found"); });

	// 5xx Fatal error
	app.use(function (err: any, req: express.Request, res: express.Response, next: express.NextFunction): any {
		if (err) {
			//TODO: send email, log err, etc...
			log.error(err);
		}
		//return res.status(500).end("500 Internal Error");
		return next(err); // use express exception render
	});
}

class UnreachableNotSupportedServer extends InvalidOperationError {
	public constructor(data: never) {
		super(`Not supported server: '${JSON.stringify(data)} '`);
	}
}
