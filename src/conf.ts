import * as path from "path";
import { configuration } from "@zxnode/base";
import { fileConfiguration } from "@zxnode/config";

const configDirectory = path.join(__dirname, /* @if BUILD_TARGET=='devel' */"../" + /* @endif */"config.ini");

const configManagerSingleton: configuration.ConfigurationLike = (function () {
	return fileConfiguration(configDirectory);
})();

export default configManagerSingleton;

export interface Configuration { endpoints: Array<Configuration.Endpoint>; }

export namespace Configuration {
	export type Endpoint = HttpEndpoint | HttpsEndpoint;

	export interface HttpEndpoint {
		type: "http";
		listenHost: string;
		listenPort: number;
	}
	export interface HttpsEndpoint {
		type: "https";
		listenHost: string;
		listenPort: number;
		/**
		 * Certificate's data as Buffer or Path to file
		 */
		caCertificate: Buffer | string;
		/**
		 * Certificate's data as Buffer or Path to file
		 */
		serviceCertificate: Buffer | string;
		/**
		 * Private Key's data as Buffer or Path to file
		 */
		serviceKey: Buffer | string;
		serviceKeyPassword?: string;
		requireClientCertificate: boolean;
	}
}
