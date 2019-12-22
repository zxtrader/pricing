import { CancellationToken } from "@zxteam/contract";
import { Initable, Disposable } from "@zxteam/disposable";
import { Container, Runtime as LauncherRuntime } from "@zxteam/launcher";
import { logger } from "@zxteam/logger";

import * as _ from "lodash";

// Providers
import { ConfigurationProvider } from "./provider/ConfigurationProvider";
import { ApiProvider } from "./provider/ApiProvider";
import { EndpointsProvider } from "./provider/EndpointsProvider";
import { HostingProvider } from "./provider/HostingProvider";

const { name: serviceName, version: serviceVersion } = require("../package.json");

export default async function (cancellationToken: CancellationToken, config: null): Promise<LauncherRuntime> {
	const log = logger.getLogger("RuntimeFactory");

	log.info(`Package: ${serviceName}@${serviceVersion}`);

	const configurationProvider: ConfigurationProvider = Container.get(ConfigurationProvider);

	log.info("Initializing ConfigurationProvider...");
	await configurationProvider.init(cancellationToken);
	try {
		log.info("Initializing DI runtime...");
		await Initable.initAll(cancellationToken,
			Container.get(ApiProvider),
			Container.get(EndpointsProvider),
			Container.get(HostingProvider)
		);

		return {
			async destroy() {
				log.info("Destroying DI runtime...");

				await Disposable.disposeAll(
					// Endpoints should dispose first (reply 503, while finishing all active requests)
					Container.get(EndpointsProvider),
					Container.get(HostingProvider),
					Container.get(ApiProvider),
					configurationProvider
				);
			}
		};
	} catch (e) {
		await configurationProvider.dispose();
		throw e;
	}
}


class UnreachableEndpointError extends Error {
	public constructor(endpoint: never) {
		super(`Not supported endpoint: ${JSON.stringify(endpoint)}`);
	}
}
