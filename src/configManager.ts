import * as path from "path";
import { configuration } from "@zxnode/base";
import { fileConfiguration } from "@zxnode/config";

const configDirectory = path.join(__dirname, /* @if BUILD_TARGET=='devel' */"../" + /* @endif */"config.ini");

const configManagerSingleton: configuration.ConfigurationLike = (function () {
	return fileConfiguration(configDirectory);
})();

export default configManagerSingleton;
