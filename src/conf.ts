import * as zxteam from "@zxteam/contract";

import { Configuration } from "@zxteam/contract";
import { ArgumentConfig, Sources, PriceMode } from ".";
import { Router } from "express-serve-static-core";

export interface Configuration { endpoints: Array<Configuration.Endpoint>; }

export namespace Configuration {
	export type Endpoint = HttpEndpoint | HttpsEndpoint | ExpressRouterEndpoint;

	export interface HttpEndpoint {
		type: "http";
		listenHost: string;
		listenPort: number;
		/**
		 * See http://expressjs.com/en/4x/api.html#trust.proxy.options.table
		 */
		trustProxy: boolean | "loopback" | "linklocal" | "uniquelocal";
	}
	export interface HttpsEndpoint {
		type: "https";
		listenHost: string;
		listenPort: number;
		/**
		 * See http://expressjs.com/en/4x/api.html#trust.proxy.options.table
		 */
		trustProxy: boolean | "loopback" | "linklocal" | "uniquelocal";
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
	export interface ExpressRouterEndpoint {
		type: "express-router";
		router: Router;
	}
}

export function configurationFactory(configuration: zxteam.Configuration): ArgumentConfig {
	const sources = helper.parseSources(configuration);

	const endpoints = configuration.getString("endpoints").split(" ").map((endpointIndex: string): Configuration.Endpoint => {
		return helper.parseEndpoint(configuration, endpointIndex);
	});

	const storageURL = helper.parseStorageUrl(configuration);

	const opts = helper.parseOpts(configuration);

	const appConfig: ArgumentConfig = { endpoints, sources, storageURL, opts };
	return appConfig;
}

export namespace helper {
	export function parseSources(configuration: zxteam.Configuration): Sources {
		const sources: Sources = {};
		// == Read configuration from config.ini file ==
		const sourceIds: Array<string> = configuration.getString("sources").split(" ");
		for (let i = 0; i < sourceIds.length; i++) {
			const sourceId = sourceIds[i];
			const parallel = configuration.getInt(`source.${sourceId}.limit.parallel`);
			const perSecond = configuration.getInt(`source.${sourceId}.limit.perSecond`);
			const perMinute = configuration.getInt(`source.${sourceId}.limit.perMinute`);
			const perHour = configuration.getInt(`source.${sourceId}.limit.perHour`);
			const timeout = configuration.getInt(`source.${sourceId}.timeout`);

			sources[sourceId] = {
				limit: {
					instance: {
						parallel,
						perSecond,
						perMinute,
						perHour
					},
					timeout
				}
			};
		}
		return sources;
	}
	export function parseEndpoint(configuration: zxteam.Configuration, endpointIndex: string): Configuration.Endpoint {
		const endpointConfiguration: zxteam.Configuration = configuration.getConfiguration(`endpoint.${endpointIndex}`);
		const endpointType = endpointConfiguration.getString("type");
		switch (endpointType) {
			case "http": {
				const httpEndpoint: Configuration.HttpEndpoint = {
					type: "http",
					listenHost: endpointConfiguration.getString("listenHost"),
					listenPort: endpointConfiguration.getInt("listenPort"),
					trustProxy: helper.parseTrustProxy(endpointConfiguration.getString("trustProxy"))
				};
				return httpEndpoint;
			}
			case "https": {
				const httpsEndpoint: Configuration.HttpsEndpoint = {
					type: "https",
					listenHost: endpointConfiguration.getString("listenHost"),
					listenPort: endpointConfiguration.getInt("listenPort"),
					trustProxy: helper.parseTrustProxy(endpointConfiguration.getString("trustProxy")),
					requireClientCertificate: endpointConfiguration.getBoolean("requireClientCertificate"),
					caCertificate: endpointConfiguration.getString("caCertificate"),
					serviceCertificate: endpointConfiguration.getString("serviceCertificate"),
					serviceKey: endpointConfiguration.getString("serviceKey"),
					serviceKeyPassword: endpointConfiguration.hasKey("serviceKeyPassword") ?
						endpointConfiguration.getString("serviceKeyPassword") : undefined
				};
				return httpsEndpoint;
			}
			default:
				throw new Error(`Non supported endpont type: ${endpointType}`);
		}
	}
	export function parseTrustProxy(val: string): boolean | "loopback" | "linklocal" | "uniquelocal" {
		switch (val) {
			case "true": return true;
			case "false": return false;
			case "loopback":
			case "linklocal":
			case "uniquelocal":
				return val;
			default:
				throw new Error(`Wrong value for trustProxy: ${val}`);
		}
	}
	export function parseStorageUrl(configuration: zxteam.Configuration): URL {
		const dataStorageUrl: string = configuration.getString("DATASTORAGE_URL");
		return new URL(dataStorageUrl);
	}
	export function parseOpts(configuration: zxteam.Configuration) {
		const priceMode: string = configuration.getString("PRICE_MODE");
		switch (priceMode) {
			case "DEMAND": {
				return { priceMode: PriceMode.DEMAND };
			}
			case "SYNC": {
				return { priceMode: PriceMode.SYNC };
			}
			default: {
				throw new Error(`Don't support  this mode: ${priceMode}`);
			}
		}
	}
}
