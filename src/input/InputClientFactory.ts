import { ArgumentError, ConfigurationError } from "@zxteam/errors";
import { Configuration, ConfigurationProvider } from "..";
import { CoinApi } from "./CoinApi";
import Cryptocompare from "./Cryptocompare";
import { PriceLoader } from "./PriceLoader";
import { YahooFinance } from "./YahooFinance";

export class InputClientFactory {
	private readonly _configurationProvider: ConfigurationProvider;

	constructor(configurationProvider: ConfigurationProvider) {
		this._configurationProvider = configurationProvider;
	}

	public getClients(): Array<PriceLoader> {
		const sources = this._configurationProvider.sources;
		return Object.keys(sources).map((el: string) => this.getClientByName(el));
	}

	public getClientByName(name: string): PriceLoader {
		switch (name) {
			case "YAHOOFINANCE":
				if (!this._configurationProvider.sources.YAHOOFINANCE?.apiKey) {
					throw new ConfigurationError("Must be set", "YAHOOFINANCE.apiKey", "");
				}
				return new YahooFinance({}, this._configurationProvider.sources.YAHOOFINANCE.apiKey);
			case "COINAPI":
				if (!this._configurationProvider.sources.COINAPI?.apiKey) {
					throw new ConfigurationError("Must be set", "COINAPI.apiKey", "");
				}
				return new CoinApi({}, this._configurationProvider.sources.COINAPI.apiKey);
			case "CRYPTOCOMPARE":
				if (!this._configurationProvider.sources.CRYPTOCOMPARE?.apiKey) {
					throw new ConfigurationError("Must be set", "COINAPI.apiKey", "");
				}
				return new Cryptocompare({}, this._configurationProvider.sources.CRYPTOCOMPARE.apiKey);
			default:
				throw new ArgumentError(`Unknown input client ${name}`);
		}
	}
}
