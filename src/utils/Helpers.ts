import financial from "@zxteam/financial";
import _ = require("lodash");
import { PriceApi } from "../api/PriceApi";

export namespace Helpers {
	export function addPriceTimeStamp(
		friendlyPrices: PriceApi.Timestamp,
		ts: number,
		marketCurrency: string,
		tradeCurrency: string,
		avgPrice?: string | null,
		sourceId?: string,
		sourcePrice?: string | null
	): PriceApi.Timestamp {
		if (!(ts in friendlyPrices)) {
			friendlyPrices[ts] = {};
		}
		if (!(marketCurrency in friendlyPrices[ts])) {
			friendlyPrices[ts][marketCurrency] = {};
		}
		if (!(tradeCurrency in friendlyPrices[ts][marketCurrency])) {
			if ((avgPrice)) {
				friendlyPrices[ts][marketCurrency][tradeCurrency] = {
					avg: {
						price: avgPrice
					}
				};
			}
			if (!(avgPrice)) {
				friendlyPrices[ts][marketCurrency][tradeCurrency] = {
					avg: null
				};
			}
		}
		if ((sourceId) && (sourcePrice) && !(sourceId in friendlyPrices[ts][marketCurrency][tradeCurrency])) {
			if (!("sources" in friendlyPrices[ts][marketCurrency][tradeCurrency])) {
				friendlyPrices[ts][marketCurrency][tradeCurrency].sources = {};
			}
			friendlyPrices[ts][marketCurrency][tradeCurrency].sources =
				Object.assign(
					friendlyPrices[ts][marketCurrency][tradeCurrency].sources,
					{
						[sourceId]: {
							price: financial.parse(sourcePrice).toString()
						}
					});
		}
		return friendlyPrices;
	}

	export function MaskUriPasswords(uri: string) {

		const rx = /^(.*\:\/\/[^:]*\:)([^@]*)(\@.*)$/g;
	
		const handle = (u: string) => {
	
			const mtchs = rx.exec(u.trim());
	
			if (!mtchs) {
				return u;
			}
	
			return `${mtchs[1]}*****${mtchs[3]}`;
		};
	
		return _.map(uri.split(","), handle).join(", ");
	}
}
