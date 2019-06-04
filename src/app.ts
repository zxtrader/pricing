import { launcher, LaunchError } from "@zxteam/launcher";
import { default as configManager } from "./conf";
import { Configuration } from "./conf";
import runtimeFactory, { ArgumentConfig, OptionsEnv, Sources, PriceMode } from "./index";
import express = require("express");

function configFactory(): Promise<ArgumentConfig> {
	const sources: Sources = {};

	try {
		// == Read configuration from config.ini file ==
		const sourceIds: Array<string> = configManager.getString("sources").split(" ");
		for (let i = 0; i < sourceIds.length; i++) {
			const sourceId = sourceIds[i];
			const parallel = configManager.getInt(`source.${sourceId}.limit.parallel`);
			const perSecond = configManager.getInt(`source.${sourceId}.limit.perSecond`);
			const perMinute = configManager.getInt(`source.${sourceId}.limit.perMinute`);
			const perHour = configManager.getInt(`source.${sourceId}.limit.perHour`);
			const timeout = configManager.getInt(`source.${sourceId}.timeout`);

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

		// == Read configuration from ENV ==
		// Mode of service
		const priceMode: string = process.env.PRICE_MODE || "DEMAND";
		// Url for connection database redis://[username:password@]host[:port][/db-number][?option=value]
		const dataStorageUrl: string = process.env.DATASTORAGE_URL || "redis://localhost:6379/5";
		// Enable http endpoint
		const httpEnable: string = process.env.HTTP_ENABLE || "yes";
		// Http host name endpoint
		const httpHost: string = process.env.HTTP_HOST || "0.0.0.0";
		// Http port endpoint
		const httpPort: number = Number.parseInt(process.env.HTTP_PORT || "8080");
		// Enable https endpoint
		const httpsEnable: string = process.env.HTTPS_ENABLE || "no";
		// Https host name endpoint
		const httpsHost: string = process.env.HTTP_HOST || "127.0.0.1";
		// Https port endpoint
		const httpsPort: number = Number.parseInt(process.env.HTTP_PORT || "8443");
		// Https list CA cert
		const httpsCaCert: Array<string> | null = (process.env.HTTPS_CACERTS) ? (process.env.HTTPS_CACERTS).split(" ") : null;
		// Https path to Cart or base64 is string
		const httpsCert: string | undefined = process.env.HTTPS_CERT;
		// Https path to private key or base64 is string
		const httpsKey: string | undefined = process.env.HTTPS_KEY;
		// Https password from private key
		const httpsKeyPhassPhrase: string | null = (process.env.HTTPS_KEY_PHASSPHRASE) ? process.env.HTTPS_KEY_PHASSPHRASE : null;

		const endpointSetting = {
			httpEnable,
			httpHost,
			httpPort,
			httpsEnable,
			httpsHost,
			httpsPort,
			httpsCaCert,
			httpsCert,
			httpsKey,
			httpsKeyPhassPhrase
		};
		const endpoint = getOptsForHttp(endpointSetting);
		const endpoints: Array<Configuration.Endpoint | express.Router> = [endpoint];

		let opts: OptionsEnv;
		switch (priceMode) {
			case PriceMode.SYNC:
				opts = { priceMode: PriceMode.SYNC };
				break;
			case PriceMode.DEMAND:
				opts = { priceMode: PriceMode.DEMAND };
				break;
			default:
				throw new Error(`Don't support  this mode: ${priceMode}`);
		}

		const storageURL: URL = new URL(dataStorageUrl);

		const friendlyOpts: ArgumentConfig = {
			endpoints,
			opts,
			sources,
			storageURL
		};

		return Promise.resolve(friendlyOpts);
	} catch (err) {
		return Promise.reject(new LaunchError(err.message));
	}
}

launcher(configFactory, runtimeFactory);

export function getOptsForHttp(envOpts: any): Configuration.Endpoint {
	if (envOpts.httpEnable === "yes") {
		const opts: Configuration.HttpEndpoint = {
			type: "http",
			listenHost: String(envOpts.httpHost),
			listenPort: Number(envOpts.httpPort)
		};
		return opts;
	}
	if (envOpts.httpsEnable === "yes") {
		if (envOpts.httpsCert === undefined) {
			throw new Error("Do not have settings for httpsCert endpoint");
		}
		if (envOpts.httpsKey === undefined) {
			throw new Error("Do not have settings for httsKey endpoint");
		}
		const opts: Configuration.HttpsEndpoint = {
			type: "https",
			listenHost: String(envOpts.httpsHost),
			listenPort: Number(envOpts.httpsPort),
			caCertificate: String(envOpts.httpsCaCert),
			serviceCertificate: String(envOpts.httpsCert),
			serviceKey: String(envOpts.httpsKey),
			serviceKeyPassword: String(envOpts.httpsKeyPhassPhrase),
			requireClientCertificate: true
		};
		return opts;
	}
	throw new Error("Http(s) endpoint do not enable");
}
