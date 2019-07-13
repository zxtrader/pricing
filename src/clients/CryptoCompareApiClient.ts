import * as zxteam from "@zxteam/contract";
import { ensureFactory, Ensure } from "@zxteam/ensure.js";
import RestClient from "@zxteam/restclient";
import { Task } from "@zxteam/task";

import * as _ from "lodash";
import { URL } from "url";
import financial from "@zxteam/financial.js";

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

		const webResult = await this.invokeWebMethodGet(ct, "price", {
			queryArgs: {
				fsym: tradeCurrency,
				tsyms: marketCurrency,
				extraParams: this._appName
			}
		});

		const data = ensure.object(webResult.bodyAsJson) as any;
		const price = ensure.number(data[marketCurrency] as number);

		return financial.fromFloat(price, 8);
	}
}
