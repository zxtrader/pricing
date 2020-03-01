import { CancellationToken, Configuration as RawConfiguration } from "@zxteam/contract";
import { Initable, Disposable } from "@zxteam/disposable";
import { Container, Runtime as LauncherRuntime } from "@zxteam/launcher";
import { logger } from "@zxteam/logger";

import * as _ from "lodash";

// Providers
import { ConfigurationProvider, ConfigurationProviderImpl } from "./provider/ConfigurationProvider";
import { ApiProvider } from "./provider/ApiProvider";
import { EndpointsProvider } from "./provider/EndpointsProvider";
import { HostingProvider } from "./provider/HostingProvider";

import { Configuration } from "./Configuration";

export { Configuration } from "./Configuration";
export { PriceApi } from "./api/PriceApi";
export { PriceApiJsonRpcHost } from "./endpoint/PriceApiJsonRpcHost";
export { RestEndpoint } from "./endpoint/RestEndpoint";
export { ApiProvider } from "./provider/ApiProvider";
export { ConfigurationProvider } from "./provider/ConfigurationProvider";

const { name: serviceName, version: serviceVersion } = require("../package.json");


export default async function (cancellationToken: CancellationToken, config?: Configuration): Promise<LauncherRuntime> {
	const log = logger.getLogger("RuntimeFactory");

	log.info(`Package: ${serviceName}@${serviceVersion}`);

	if (config !== undefined) {
		log.info("Initializing ConfigurationProvider...");
		const ownProvider: ConfigurationProvider = new ConfigurationProviderImpl(config);
		Container.bind(ConfigurationProvider).provider({ get() { return ownProvider; } });
	} else {
		log.info("Using ConfigurationProvider provded by userF...");
	}

	log.info("Initializing DI runtime...");
	await Initable.initAll(cancellationToken,
		Container.get(HostingProvider),
		Container.get(ApiProvider),
		Container.get(EndpointsProvider)
	);

	// coinGetRecorderRedisSubscriber = new CoinGetRecorderRedisSubscriber(new URL("redis://local00.zxteam.net:65505?keepAlive=5"));
	// await coinGetRecorderRedisSubscriber.init(cancellationToken);

	// let swithcer = false;
	// function fakeHandler(event: RealtimePriceStream.Event | Error) {
	// 	//
	// 	if (event instanceof Error) { return; }
	// 	console.log(JSON.stringify(event.data));
	// }
	// const faker = setInterval(function () {
	// 	swithcer = !swithcer;
	// 	if (swithcer === true) {
	// 		coinGetRecorderRedisSubscriber.addHandler(fakeHandler);
	// 	} else {
	// 		coinGetRecorderRedisSubscriber.removeHandler(fakeHandler);
	// 	}
	// }, 10000);

	return {
		async destroy() {
			log.info("Destroying DI runtime...");
			//clearInterval(faker);
			await Disposable.disposeAll(
				//coinGetRecorderRedisSubscriber,
				// Endpoints should dispose first (reply 503, while finishing all active requests)
				Container.get(EndpointsProvider),
				Container.get(ApiProvider),
				Container.get(HostingProvider)
			);
		}
	};
}


class UnreachableEndpointError extends Error {
	public constructor(endpoint: never) {
		super(`Not supported endpoint: ${JSON.stringify(endpoint)}`);
	}
}
