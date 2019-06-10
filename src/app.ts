import * as zxteam from "@zxteam/contract";
import { launcher, LaunchError } from "@zxteam/launcher";
import { configurationFactory } from "./conf";
import { envConfiguration, chainConfiguration, fileConfiguration, swarmSecretsConfiguration } from "@zxteam/configuration";
import runtimeFactory, { ArgumentConfig } from "./index";
import * as fs from "fs";
import * as util from "util";

const exists = util.promisify(fs.exists);

function appConfigurationFactory(): Promise<ArgumentConfig> {
	return Promise.resolve().then(async () => {
		const configFileArg = process.argv.find(w => w.startsWith("--config="));
		if (configFileArg === undefined) {
			throw new LaunchError("An argument --config is not passed");
		}

		const chainItems: Array<zxteam.Configuration> = [];

		const envConf = envConfiguration();
		chainItems.push(envConf);

		const isSecretsPresents = await exists("/run/secrets");
		if (isSecretsPresents) {
			const swarmConf = await swarmSecretsConfiguration("/run/secrets");
			chainItems.push(swarmConf);
		}

		const configFile = configFileArg.substring(9); // Cut --config=
		const fileConf = fileConfiguration(configFile);
		chainItems.push(fileConf);

		const appConfiguration = configurationFactory(
			chainConfiguration(...chainItems)
		);
		return appConfiguration;
	});
}

launcher(appConfigurationFactory, runtimeFactory);


