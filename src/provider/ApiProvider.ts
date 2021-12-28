import { CancellationToken, Logger } from "@zxteam/contract";
import { Disposable, Initable } from "@zxteam/disposable";
import { InvalidOperationError } from "@zxteam/errors";
import { Container, Provides, Singleton } from "@zxteam/launcher";
import { logger } from "@zxteam/logger";

import { ConfigurationProvider } from "./ConfigurationProvider";

import { PriceApi } from "../api/PriceApi";
import { PriceApiImpl } from "../api/PriceApiImpl";
import { RedisStorage } from "../storage/RedisStorage";
import { PriceLoader } from "../input/PriceLoader";
import Cryptocompare from "../input/Cryptocompare";
import { PostgresStogare } from "../storage/PostgresStorage";
import { YahooFinance } from "../input/YahooFinance";
import { CoinApi } from "../input/CoinApi";
import { InputClientFactory } from "../input/InputClientFactory";


@Singleton
export abstract class ApiProvider extends Initable {
	protected readonly log: Logger;

	public constructor() {
		super();
		this.log = logger.getLogger("Endpoints");
	}

	public abstract get price(): PriceApi;
}


@Provides(ApiProvider)
class ApiProviderImpl extends ApiProvider {
	// Do not use Inject inside providers to prevents circular dependency
	private readonly _configurationProvider: ConfigurationProvider;

	private readonly _priceApi: PriceApiImpl;

	public constructor() {
		super();

		this._configurationProvider = Container.get(ConfigurationProvider);
		const inputClientFactory = new InputClientFactory(this._configurationProvider);
		const sourceProviders: Array<PriceLoader> = inputClientFactory.getClients();

		this._priceApi = new PriceApiImpl({
			// storageFactory: () => new RedisStorage(this._configurationProvider.storageURL, this._configurationProvider.sourcesPriorityQueue),
			storageFactory: () => new PostgresStogare(this._configurationProvider.postgresDbUrl, this._configurationProvider.sourcesPriorityQueue),
			sourceProviders,
			coingetRecorderStreamRedisURL: this._configurationProvider.coingetRecorderStreamRedisURL,
			log: this.log.getLogger("PriceApi"),
			aggregatedPriceSourceName: this._configurationProvider.aggregatedPriceSourceName
		});
	}

	public get price(): PriceApi { return this._priceApi; }

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		await Initable.initAll(cancellationToken, this._priceApi);
	}

	protected async onDispose(): Promise<void> {
		await Disposable.disposeAll(this._priceApi);
	}
}
