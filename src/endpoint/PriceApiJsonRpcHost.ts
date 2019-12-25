import { CancellationToken } from "@zxteam/contract";
import { Disposable } from "@zxteam/disposable";
import { SubscriberChannelMixin } from "@zxteam/channels";
import { Ensure, EnsureError, ensureFactory } from "@zxteam/ensure";
import { JsonRpcHost, Notification, Request, Response } from "@zxteam/jsonrpc";

import * as _ from "lodash";
import { v4 as uuid } from "uuid";

import { PriceService } from "../api/PriceService";

const ensure: Ensure = ensureFactory();

export class PriceServiceJsonRpcHost extends Disposable implements JsonRpcHost {
	private _priceService: PriceService;
	private _rateChannels: Map<string, {
		readonly channel: PriceService.ChangeRateNotification.Channel;
		readonly opts: { readonly marketCurrency: string, readonly tradeCurrency: string; };
		disposer(): Promise<void>;
	}>;

	public constructor(priceService: PriceService) {
		super();
		this._priceService = priceService;
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
			// case "rate": {
			// 	//> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"USDT",
			//"tradeCurrency":"BTC","exchangeId":"BINANCE","date":"2019-07-01T10:20:33Z"}}
			// 	const result = await this._getExchanges(cancellationToken);
			// 	return { jsonrpc, id, result };
			// }
			case "subscribe": {
				const topicName = ensure.string((ensure.defined(params) as any).topic);
				switch (topicName) {
					case "rate": {
						const opts = ensure.defined((ensure.defined(params) as any).opts);
						const marketCurrency: string = ensure.string(opts.marketCurrency);
						const tradeCurrency: string = ensure.string(opts.tradeCurrency);
						const result = await this._subscribeRate(cancellationToken, marketCurrency, tradeCurrency);
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
			// case "unsubscribe": {
			// 	const subscribeIds: ReadonlyArray<string> = ensure.string((ensure.defined(params) as any).exchangeId);
			// 	const result = await this._unsubscribe(cancellationToken, subscribeIds);
			// 	return { jsonrpc, id, result };
			// }
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
		const rateChannelBundles = [...this._rateChannels.values()];
		this._rateChannels.clear();
		for (const rateChannelBundle of rateChannelBundles) {
			await rateChannelBundle.disposer();
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

	private async _subscribeRate(
		cancellationToken: CancellationToken,
		marketCurrency: string,
		tradeCurrency: string
	): Promise<Response.Success["result"]> {
		const subscribeId: string = "token-" + uuid();
		const rateChannel = await this._priceService.createChangeRateSubscriber(cancellationToken, marketCurrency, tradeCurrency);

		const handler = (event: PriceService.ChangeRateNotification.Event | Error): void | Promise<void> => {
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
		return subsсiptionList;
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
export interface PriceServiceJsonRpcHost extends SubscriberChannelMixin<Notification> { }
SubscriberChannelMixin.applyMixin(PriceServiceJsonRpcHost);
