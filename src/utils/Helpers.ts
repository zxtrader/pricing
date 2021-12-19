import financial from "@zxteam/financial";
import _ = require("lodash");
import { PriceApi } from "../api/PriceApi";

export namespace Helpers {
	export function AddPriceTimeStamp(
		friendlyPrices: PriceApi.Timestamp,
		ts: number,
		marketCurrency: string,
		tradeCurrency: string,
		primaryPrice?: string | null,
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
			if ((primaryPrice)) {
				friendlyPrices[ts][marketCurrency][tradeCurrency] = {
					primary: {
						price: primaryPrice
					}
				};
			}
			if (!(primaryPrice)) {
				friendlyPrices[ts][marketCurrency][tradeCurrency] = {
					primary: null
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

	export function SetPrimaryPrice(
		friendlyPrices: PriceApi.Timestamp,
		sourcesQueue: ReadonlyArray<string>
	) {
		for (const ts in friendlyPrices) {
			for (const marketCurrency in friendlyPrices[ts]) {
				for (const tradeCurrency in friendlyPrices[ts][marketCurrency]) {
					const sources = friendlyPrices[ts][marketCurrency][tradeCurrency].sources;
					if (!sources || Object.keys(sources).length === 0) {
						throw new Error("Empty sources. Can not set primary price.");
					}
					friendlyPrices[ts][marketCurrency][tradeCurrency].primary = {
						price: sources[Object.keys(sources)[0]].price,
					};
					const sourceIds = Object.keys(sources);
					for (const source of sourcesQueue) {
						if (sourceIds.includes(source)) {
							friendlyPrices[ts][marketCurrency][tradeCurrency].primary = {
								price: sources[source].price,
							};
							break;
						}
					}
				}
			}
		}
	}
}
