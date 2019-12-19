import * as zxteam from "@zxteam/contract";
import { ensureFactory, Ensure } from "@zxteam/ensure";
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
}
