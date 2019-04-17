import * as path from "path";
import { configuration } from "@zxnode/base";
import { develVirtualFilesConfiguration, fileConfiguration } from "@zxnode/config";

const configDirectory = path.join(__dirname, /* @if BUILD_TARGET=='devel' */"../" + /* @endif */"coinget-backend.config");

const configManagerSingleton: configuration.ConfigurationLike = (function () {
	//return fileConfiguration(configDirectory, process.env.SITE/* @if BUILD_TARGET=='devel' */, true/* @endif */);
	return fileConfiguration(configDirectory);
})();

export default configManagerSingleton;
