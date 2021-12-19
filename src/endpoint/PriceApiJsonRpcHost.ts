import { CancellationToken, Financial } from "@zxteam/contract";
import { Disposable } from "@zxteam/disposable";
import { SubscriberChannelMixin } from "@zxteam/channels";
import { Ensure, EnsureError, ensureFactory } from "@zxteam/ensure";
import { JsonRpcHost, Notification, Request, Response } from "@zxteam/jsonrpc";

import * as _ from "lodash";
import * as moment from "moment";
import { v4 as uuid } from "uuid";

import { PriceApi } from "../api/PriceApi";
import { InvalidOperationError } from "@zxteam/errors";

const ensure: Ensure = ensureFactory();

export class PriceApiJsonRpcHost extends Disposable implements JsonRpcHost {
	private _priceService: PriceApi;
	private _priceChannels: Map<string, {
		readonly channel: PriceApi.ChangePriceNotification.Channel;
		readonly opts: { readonly pairs: ReadonlyArray<string>, readonly exchanges: ReadonlyArray<string>; };
		disposer(): Promise<void>;
	}>;
	private _rateChannels: Map<string, {
		readonly channel: PriceApi.ChangeRateNotification.Channel;
		readonly opts: { readonly marketCurrency: string, readonly tradeCurrency: string; };
		disposer(): Promise<void>;
	}>;

	public constructor(priceService: PriceApi) {
		super();
		this._priceService = priceService;
		this._priceChannels = new Map();
		this._rateChannels = new Map();
	}

	public async invoke(cancellationToken: CancellationToken, args: Request): Promise<Response> {
		const { jsonrpc, id, method, params } = args;
		switch (args.method) {
			case "ping": {
				const echo = ensure.string((ensure.defined(params) as any).echo);
				const result = await this._ping(cancellationToken, echo);
				return { jsonrpc, id, result };
			}
			case "rate": {
				const rateParams: any = ensure.defined(params);
				const marketCurrency: string = ensure.string(rateParams.marketCurrency);
				const tradeCurrency: string = ensure.string(rateParams.tradeCurrency);

				const opts: {
					exchangeId?: string;
					date?: Date;
				} = {};

				if ("exchange" in rateParams) {
					opts.exchangeId = ensure.string(rateParams.exchange);
				}
				if ("date" in rateParams) {
					opts.date = new Date(ensure.string(rateParams.date));
				}
				const result: string = await this._rate(cancellationToken, marketCurrency, tradeCurrency, opts);
				return { jsonrpc, id, result };
			}
			case "subscribe": {
				const topicName = ensure.string((ensure.defined(params) as any).topic);
				const threshold = ensure.integer((ensure.defined(params) as any).threshold);
				if (threshold < 1) { throw new EnsureError("Bad threshold value. Expected above zero.", threshold); }
				const opts = ensure.defined((ensure.defined(params) as any).opts);
				switch (topicName) {
					case "price": {
						//{"opts":{"pairs":["BTC/USD","BTC/USDC","BTC/EUR","ETH/USD","ETH/USDC","ETH/EUR","ETH/BTC"],"exchanges":["BINANCE","POLONIEX"]}}
						const pairs: Array<string> = ensure.array(opts.pairs).filter((pair): pair is string => {
							if (_.isString(pair)) { return true; }
							throw new EnsureError("Wrong pairs value. Expected array of string.", opts.pairs);
						});
						const exchanges: Array<string> = "exchanges" in opts
							? ensure.array(opts.exchanges).filter((exchange): exchange is string => {
								if (_.isString(exchange)) { return true; }
								throw new EnsureError("Wrong exchanges value. Expected array of string.", opts.exchanges);
							}) : [];
						const result = await this._subscribePrice(cancellationToken, threshold, pairs, exchanges);
						return { jsonrpc, id, result };
					}
					case "rate": {
						const marketCurrency: string = ensure.string(opts.marketCurrency);
						const tradeCurrency: string = ensure.string(opts.tradeCurrency);
						const result = await this._subscribeRate(cancellationToken, threshold, marketCurrency, tradeCurrency);
						return { jsonrpc, id, result };
					}
					default: {
						return {
							jsonrpc, id, error: {
								code: Response.ErrorCode.InvalidRequest,
								message: `Wrong topic name: ${method}`
							}
						};
					}
				}
			}
			case "subsсiptions": {
				const result = await this._subsсiptionList(cancellationToken);
				return { jsonrpc, id, result };
			}
			case "unsubscribe": {
				const subscribeIds: ReadonlyArray<string> = ensure.array((ensure.defined(params) as any));
				await this._unsubscribe(cancellationToken, subscribeIds);
				return { jsonrpc, id, result: true };
			}
			default: {
				return {
					jsonrpc, id, error: {
						code: Response.ErrorCode.MethodNotFound,
						message: `Wrong method name: ${method}`
					}
				};
			}
		}
	}

	protected async onDispose() {
		{ // priceChannels
			const priceChannelBundles = [...this._priceChannels.values()];
			this._priceChannels.clear();
			for (const priceChannelBundle of priceChannelBundles) {
				await priceChannelBundle.disposer();
			}
		}
		{ // rateChannels
			const rateChannelBundles = [...this._rateChannels.values()];
			this._rateChannels.clear();
			for (const rateChannelBundle of rateChannelBundles) {
				await rateChannelBundle.disposer();
			}
		}
	}

	private async _ping(cancellationToken: CancellationToken, echo: string): Promise<Response.Success["result"]> {
		const pingResult = await this._priceService.ping(cancellationToken, echo);
		return {
			echo,
			time: pingResult.time,
			version: pingResult.version
		};

	}

	private async _rate(
		cancellationToken: CancellationToken,
		marketCurrency: string,
		tradeCurrency: string,
		opts: {
			readonly exchangeId?: string;
			readonly date?: Date;
		}
	): Promise<string> {
		const ts: number = Number(opts.date !== undefined ? moment(opts.date).format("YYYYMMDDHHmmss") : moment(new Date()).format("YYYYMMDDHHmmss"));
		const histPrice = await this._priceService.getHistoricalPrices(cancellationToken, [{
			marketCurrency, tradeCurrency,
			ts,
			requiredAllSourceIds: false
		}]);

		const primary = histPrice[ts][marketCurrency][tradeCurrency].primary;
		if (primary !== null) {
			return primary.price;
		}

		throw new Error("Cannot get rate");
	}

	private async _subscribePrice(
		cancellationToken: CancellationToken,
		threshold: number,
		pairs: ReadonlyArray<string>,
		exchanges: ReadonlyArray<string>
	): Promise<Response.Success["result"]> {
		const subscribeId: string = "token-" + uuid();
		const priceChannel: PriceApi.ChangePriceNotification.Channel
			= await this._priceService.createChangePriceSubscriber(cancellationToken, threshold, pairs, exchanges);

		const handler = (event: PriceApi.ChangePriceNotification.Event | Error): void | Promise<void> => {
			if (event instanceof Error) {
				return;
			}

			const { data } = event;

			const prices: {
				[marketCurrency: string]: {
					[tradeCurrency: string]: {
						[sourceSystem: string]: Financial | null;
					};
				};
			} = {};

			// Format respose prices
			for (const [marketCurrency, sourceMarketCurrencyTuple] of _.entries(data.prices)) {
				if (!(marketCurrency in prices)) { prices[marketCurrency] = {}; }
				const targetMarketCurrencyTuple = prices[marketCurrency];

				for (const [tradeCurrency, sourceTradeCurrencyTuple] of _.entries(sourceMarketCurrencyTuple)) {
					if (!(tradeCurrency in targetMarketCurrencyTuple)) { targetMarketCurrencyTuple[tradeCurrency] = {}; }
					const targetTradeCurrencyTuple = targetMarketCurrencyTuple[tradeCurrency];

					for (const [sourceSystem, price] of _.entries(sourceTradeCurrencyTuple)) {
						targetTradeCurrencyTuple[sourceSystem] = price;
					}
				}
			}

			return this.notify({
				data: {
					jsonrpc: "2.0",
					method: subscribeId,
					params: {
						date: data.date.toISOString(),
						prices
					}
				}
			});
		};

		priceChannel.addHandler(handler);
		async function disposer() {
			priceChannel.removeHandler(handler);
			await priceChannel.dispose();
		}
		this._priceChannels.set(subscribeId, Object.freeze({
			channel: priceChannel,
			opts: { pairs, exchanges },
			disposer
		}));

		return { subscribeId };
	}

	private async _subscribeRate(
		cancellationToken: CancellationToken,
		threshold: number,
		marketCurrency: string,
		tradeCurrency: string
	): Promise<Response.Success["result"]> {
		const subscribeId: string = `token-${tradeCurrency}-${marketCurrency}`;
		const rateChannel: PriceApi.ChangeRateNotification.Channel
			= await this._priceService.createChangeRateSubscriber(cancellationToken, threshold, marketCurrency, tradeCurrency);

		const handler = (event: PriceApi.ChangeRateNotification.Event | Error): void | Promise<void> => {
			if (event instanceof Error) {
				return;
			}

			const { data } = event;
			return this.notify({
				data: {
					jsonrpc: "2.0",
					method: subscribeId,
					params: {
						date: data.date.toISOString(),
						price: data.price
					}
				}
			});
		};

		rateChannel.addHandler(handler);
		async function disposer() {
			rateChannel.removeHandler(handler);
			await rateChannel.dispose();
		}
		this._rateChannels.set(subscribeId, Object.freeze({
			channel: rateChannel,
			opts: { marketCurrency, tradeCurrency },
			disposer
		}));

		return { subscribeId };
	}

	private async _subsсiptionList(cancellationToken: CancellationToken): Promise<Response.Success["result"]> {
		const subsсiptionList: { [token: string]: any; } = {};
		for (const [token, subsсiptionBundle] of this._rateChannels) {
			subsсiptionList[token] = subsсiptionBundle.opts;
		}
		for (const [token, subsсiptionBundle] of this._priceChannels) {
			subsсiptionList[token] = subsсiptionBundle.opts;
		}
		return subsсiptionList;
	}

	private async _unsubscribe(cancellationToken: CancellationToken, subscribeIds: ReadonlyArray<string>): Promise<void> {
		for (const subscribeId of subscribeIds) {
			cancellationToken.throwIfCancellationRequested();
			if (this._priceChannels.has(subscribeId)) {
				const priceChannel = this._priceChannels.get(subscribeId)!;
				this._priceChannels.delete(subscribeId);
				await priceChannel.disposer();
			}

			cancellationToken.throwIfCancellationRequested();
			if (this._rateChannels.has(subscribeId)) {
				const rateChannel = this._rateChannels.get(subscribeId)!;
				this._rateChannels.delete(subscribeId);
				await rateChannel.disposer();
			}
		}
	}

	// private async _getSubsсiptions(cancellationToken: CancellationToken): Promise<Response.Success["result"]> {
	// 	interface ExchangeManifest {
	// 		readonly name: string;
	// 		readonly url: URL;
	// 		readonly descriptionHtml: string;
	// 		// readonly icon16Url: URL;
	// 		// readonly icon32Url: URL;
	// 		// readonly icon64Url: URL;
	// 		// readonly icon128Url: URL;
	// 		// readonly icon256Url: URL;
	// 		// readonly icon512Url: URL;
	// 		// readonly iconLogoUrl: URL;
	// 	}

	// 	const exchangeManifests = await this._priceService.createChangeRateSubscriber(cancellationToken);

	// 	const friendlyExchanges: { [id: string]: ExchangeManifest } =
	// 		_.mapValues(exchangeManifests, function (exchangeManifest: InfoService.ExchangeManifest) {
	// 			const result: ExchangeManifest = {
	// 				name: exchangeManifest.name,
	// 				url: exchangeManifest.url,
	// 				descriptionHtml: exchangeManifest.descriptionHtml
	// 				// icon16Url: new URL("icon/" + exchangeManifest.icon16UUID, bindURL),
	// 				// icon32Url: new URL("icon/" + exchangeManifest.icon32UUID, bindURL),
	// 				// icon64Url: new URL("icon/" + exchangeManifest.icon64UUID, bindURL),
	// 				// icon128Url: new URL("icon/" + exchangeManifest.icon128UUID, bindURL),
	// 				// icon256Url: new URL("icon/" + exchangeManifest.icon256UUID, bindURL),
	// 				// icon512Url: new URL("icon/" + exchangeManifest.icon512UUID, bindURL),
	// 				// iconLogoUrl: new URL("icon/" + exchangeManifest.iconLogoUUID, bindURL)
	// 			};
	// 			return result;
	// 		});
	// 	return friendlyExchanges;
	// }

	// private async _getMarkets(cancellationToken: CancellationToken, exchangeId: string): Promise<Response.Success["result"]> {
	// 	const responseData = await this._priceService.getExchangeMarkets(cancellationToken, exchangeId);
	// 	//const result = _.mapValues(responseData, (value: ReadonlyArray<string>) => { return value; });
	// 	return responseData;
	// }

	// private async _getSettings(cancellationToken: CancellationToken, exchangeId: string): Promise<Response.Success["result"]> {
	// 	const responseData = await this._priceService.getExchangeSettings(cancellationToken, exchangeId);
	// 	return responseData;
	// }
}
export interface PriceApiJsonRpcHost extends SubscriberChannelMixin<Notification> { }
SubscriberChannelMixin.applyMixin(PriceApiJsonRpcHost);
