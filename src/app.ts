import { CancellationToken, Configuration as RawConfiguration } from "@zxteam/contract";
import { launcher, LaunchError } from "@zxteam/launcher";
import { configurationFactory, Configuration } from "./conf";
import { envConfiguration, chainConfiguration, fileConfiguration, secretsDirectoryConfiguration } from "@zxteam/configuration";
import runtimeFactory from "./index";

import * as _ from "lodash";
import * as fs from "fs";
import * as path from "path";
import * as util from "util";

const exists = util.promisify(fs.exists);

function appConfigurationFactory(cancellationToken: CancellationToken): Promise<Configuration> {
	return Promise.resolve().then(async () => {
		const configFileArg = process.argv.find(w => w.startsWith("--config="));
		if (configFileArg === undefined) {
			throw new LaunchError("An argument --config is not passed");
		}

		const chainItems: Array<RawConfiguration> = [];

		const envConf = envConfiguration();
		chainItems.push(envConf);

		const isSecretsPresents = await exists("/run/secrets");
		if (isSecretsPresents) {
			const swarmConf = await secretsDirectoryConfiguration("/run/secrets");
			chainItems.push(swarmConf);
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

		const appConfiguration = configurationFactory(
			chainConfiguration(...chainItems)
		);
		return appConfiguration;
	});
}

launcher(appConfigurationFactory, runtimeFactory);


