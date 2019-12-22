import { CancellationToken, Logger } from "@zxteam/contract";
import { Disposable, Initable } from "@zxteam/disposable";
import { InvalidOperationError } from "@zxteam/errors";
import { Container, Provides, Singleton } from "@zxteam/launcher";
import { logger } from "@zxteam/logger";

import { ConfigurationProvider } from "./ConfigurationProvider";

import { PriceService } from "../api/PriceService";
import { PriceServiceImpl } from "../api/PriceServiceImpl";
import { RedisStorage } from "../storage/RedisStorage";
import { PriceLoader } from "../priceLoader/PriceLoader";
import Cryptocompare from "../priceLoader/Cryptocompare";

@Singleton
export abstract class ApiProvider extends Initable {
	protected readonly log: Logger;

	public constructor() {
		super();
		this.log = logger.getLogger("Endpoints");
	}

	public abstract get price(): PriceService;
}


@Provides(ApiProvider)
class ApiProviderImpl extends ApiProvider {
	// Do not use Inject inside providers to prevents circular dependency
	private readonly _configurationProvider: ConfigurationProvider;

	private readonly _priceService: PriceServiceImpl;

	public constructor() {
		super();

		this._configurationProvider = Container.get(ConfigurationProvider);

		const sourceProviders: Array<PriceLoader> = [new Cryptocompare({})];

		this._priceService = new PriceServiceImpl(
			() => new RedisStorage(this._configurationProvider.storageURL),
			sourceProviders,
			this.log.getLogger("PriceService")
		);
	}

	public get price(): PriceService { return this._priceService; }

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		await Initable.initAll(cancellationToken, this._priceService);
	}

	protected async onDispose(): Promise<void> {
		await Disposable.disposeAll(this._priceService);
	}
}
