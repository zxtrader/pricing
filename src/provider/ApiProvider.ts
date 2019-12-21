import { CancellationToken } from "@zxteam/contract";
import { Disposable, Initable } from "@zxteam/disposable";
import { InvalidOperationError } from "@zxteam/errors";
import { Singleton, Provides, Inject } from "@zxteam/launcher";

import { PriceApi } from "../api/PriceApi";
import { ConfigurationProvider } from "./ConfigurationProvider";

@Singleton
export abstract class ApiProvider extends Initable {
	public abstract get price(): PriceApi;
}


@Provides(ApiProvider)
class ApiProviderImpl extends ApiProvider {
	@Inject
	private readonly _configurationProvider!: ConfigurationProvider;

	private readonly _priceApi: PriceApi;

	public constructor() {
		super();
		this._priceApi = new PriceApi(this._configurationProvider.storageURL, this._configurationProvider.sources);
	}

	public get price(): PriceApi { return this._priceApi; }

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		await Initable.initAll(cancellationToken, this._priceApi);
	}

	protected async onDispose(): Promise<void> {
		await Disposable.disposeAll(this._priceApi);
	}
}
