import { launcher, LaunchError } from "@zxteam/launcher";
import { default as configManager } from "./configManager";
import runtimeFactory, { ArgumentConfig } from "./index";



function configFactory(): Promise<ArgumentConfig> {
	const opts: ArgumentConfig = {
		env: {},
		sources: {}
	};
	try {
		// == Read configuration from config.ini file ==
		const sourceIds: Array<string> = configManager.getString("sources").split(" ");
		for (let i = 0; i < sourceIds.length; i++) {
			const sourceId = sourceIds[i];
			if (!(sourceId in opts.sources)) {
				opts.sources[sourceId] = {};
			}
			const url = configManager.getString(`source.${sourceId}.url`);
			const parallel = configManager.getInt(`source.${sourceId}.limit.parallel`);
			const perSecond = configManager.getInt(`source.${sourceId}.limit.perSecond`);
			const perMinute = configManager.getInt(`source.${sourceId}.limit.perMinute`);
			const perHour = configManager.getInt(`source.${sourceId}.limit.perHour`);
			const timeout = configManager.getInt(`source.${sourceId}.timeout`);

			opts.sources[sourceId] = {
				url,
				parallel,
				perSecond,
				perMinute,
				perHour,
				timeout
			};
		}

		// == Read configuration from ENV ==
		// Mode of service
		const priceMode: string = process.env.PRICE_MODE || "demand";
		// Url for connection database redis://[username:password@]host[:port][/db-number][?option=value]
		const dataStorageUrl: string = process.env.DATASTORAGE_URL || "redis://localhost:6379/5";
		// Enable http endpoint
		const httpEnable: string = process.env.HTTP_ENABLE || "yes";
		// Http host name endpoint
		const httpHost: string = process.env.HTTP_HOST || "127.0.0.1";
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

		opts.env = {
			priceMode,
			dataStorageUrl,
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

		return Promise.resolve(opts);
	} catch (err) {
		return Promise.reject(new LaunchError(err.message));
	}
}

launcher(configFactory, runtimeFactory);
