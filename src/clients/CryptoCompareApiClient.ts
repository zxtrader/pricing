import * as zxteam from "@zxteam/contract";
import { ensureFactory, Ensure, EnsureError } from "@zxteam/ensure";
import financial from "@zxteam/financial";
import RestClient from "@zxteam/web-client";

import * as _ from "lodash";
import { URL } from "url";

const ensure: Ensure = ensureFactory();

export class CryptoCompareApiClient extends RestClient {
	private readonly _appName: string;

	public constructor(userAgent: string, log: zxteam.Logger) {
		super(new URL("https://min-api.cryptocompare.com/data/"), { log, userAgent });
		this._appName = userAgent;
	}

	public async getPrice(
		ct: zxteam.CancellationToken, marketCurrency: string, tradeCurrency: string
	): Promise<zxteam.Financial> {
		// fsym - это tradeCurrency (в терминах zxtrader)

		this.verifyNotDisposed();

		const webResult = await this.get(ct, "price", {
			queryArgs: {
				fsym: tradeCurrency,
				tsyms: marketCurrency,
				extraParams: this._appName
			}
		});

		const data = ensure.object(webResult.bodyAsJson) as any;
		const price = ensure.number(data[marketCurrency] as number);

		return financial.fromFloat(price);
	}

	public async getPrices(
		ct: zxteam.CancellationToken, marketCurrencies: ReadonlyArray<string>, tradeCurrency: string
	): Promise<{
		readonly [marketCurrency: string]: zxteam.Financial;
	}> {
		// fsym - это tradeCurrency (в терминах zxtrader)

		this.verifyNotDisposed();

		const webResult = await this.get(ct, "price", {
			queryArgs: {
				fsym: tradeCurrency,
				tsyms: marketCurrencies.join(","),
				extraParams: this._appName
			}
		});

		const result: { [tradeCurrency: string]: zxteam.Financial; } = {};

		const data = ensure.object(webResult.bodyAsJson) as any;

		if ("Response" in data && data.Response === "Error") {
			if ("Message" in data && _.isString(data.Message)) {
				throw new CryptoCompareApiClient.CryptoCompareApiError(data.Message, data);
			} else {
				throw new CryptoCompareApiClient.CryptoCompareApiError("Unknown error", data);
			}
		}

		for (const marketCurrency of marketCurrencies) {
			if (marketCurrency in data) {
				const price = ensure.number(data[marketCurrency]);
				result[marketCurrency] = financial.fromFloat(price);
			} else {
				throw new EnsureError(`marketCurrency: ${marketCurrency} is not included in server response`, data);
			}
		}

		return result;
	}
}

export namespace CryptoCompareApiClient {
	export class CryptoCompareApiError extends Error {
		public readonly rawData: any;
		public constructor(message: string, rawData: any) {
			super(message);
			this.rawData = rawData;
		}
	}
}
