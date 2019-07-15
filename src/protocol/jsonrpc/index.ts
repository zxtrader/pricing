import * as zxteam from "@zxteam/contract";
import { AbstractProtocolAdapter, ProtocolAdapter } from "@zxteam/webserver";
import financial from "@zxteam/financial.js";
import { Task } from "@zxteam/task";

import * as _ from "lodash";
import { v4 as uuid } from "uuid";

// import { JsonSchemaManager, factory as jsonSchemaManagerFactory } from "../../misc/JsonSchemaManager";

import * as ArrayBufferUtils from "../../misc/ArrayBufferUtils";
import { Notification, PriceService, price } from "../../PriceService";
import { priceRuntime } from "../../endpoints";
import { Disposable } from "@zxteam/disposable";
import moment = require("moment");

export interface JsonRpcProtocolAdapterFactory {
	(callbackChannel: zxteam.PublisherChannel<string>, methodPrefix?: string): ProtocolAdapter<string>;
}

export async function factory(service: PriceService, logger: zxteam.Logger): Promise<JsonRpcProtocolAdapterFactory> {
	//const schemasDirectory = path.normalize(path.join(__dirname, "schemas"));
	//const schemaManager: JsonSchemaManager = await jsonSchemaManagerFactory(schemasDirectory, logger);


	function jsonRpcProtocolAdapterFactory(
		callbackChannel: zxteam.PublisherChannel<string>, methodPrefix?: string
	): ProtocolAdapter<string> {
		return new JsonRpcProtocolAdapter(service, callbackChannel, logger, methodPrefix);
	}

	return jsonRpcProtocolAdapterFactory;
}

export default factory;


const enum ServiceMethod {
	PING = "ping",
	RATE = "rate",
	//RATEBATCH = "batch",
	SUBSCRIBE = "subscribe",
	SUBSCRIPTIONS = "subsсiptions",
	UNSUBSCRIBE = "unsubscribe"
}

const enum SubscribtionTopic {
	RATE = "rate"
}

class JsonRpcProtocolAdapter extends AbstractProtocolAdapter<string> {
	private readonly _service: PriceService;
	private readonly _methodPrefix?: string;
	private readonly _subscribers: Map<string/* token */, TopicSubsciberHandle>;

	public constructor(
		service: PriceService, callbackChannel: ProtocolAdapter.CallbackChannel<string>, log: zxteam.Logger, methodPrefix?: string
	) {
		super(callbackChannel, log);
		this._service = service;
		this._methodPrefix = methodPrefix;
		this._subscribers = new Map();
	}

	public async handleMessage(
		cancellationToken: zxteam.CancellationToken, data: string, next?: ProtocolAdapter.Next<string>
	): Promise<string> {
		const message = JSON.parse(data);
		const result = await this.handleJsonRpcMessage(cancellationToken, message);
		if (_.isObjectLike(result) && _.isObjectLike(result.error) && result.error.code === -32601 && next !== undefined) {
			return next(cancellationToken, data);
		}
		return JSON.stringify(result);
	}

	protected onDispose(): Promise<void> {
		const innerDisposes: Array<Promise<void>> = [];
		for (const handle of this._subscribers.values()) {
			handle.stopSubscriptionEvents();
			innerDisposes.push(handle.dispose());
		}
		return Promise.all(innerDisposes).then();
	}

	private async handleJsonRpcMessage(
		cancellationToken: zxteam.CancellationToken, message: any, next?: ProtocolAdapter.Next<string>
	): Promise<any> {
		// https://www.jsonrpc.org/specification
		try {
			const { jsonrpc, method, params, id } = message;
			if (
				!(
					jsonrpc === "2.0"
					&& _.isString(method)
					&& (
						_.isInteger(id) || _.isString(id) || _.isNull(id)
					)
				)
			) {
				return {
					jsonrpc: "2.0", id: id || null, error: { code: -32600, message: "The JSON sent is not a valid Request object." }
				};
			}

			// Notifications
			// TODO

			// Methods
			if (id === null) {
				// Method call should contain valid id
				return { jsonrpc: "2.0", id: null, error: { code: -32600, message: "The JSON sent is not a valid Request object." } };
			}

			let realMethod = method;
			if (this._methodPrefix !== undefined) {
				if (!method.startsWith(this._methodPrefix)) {
					return {
						jsonrpc: "2.0", id, error: { code: -32601, message: "The method does not exist / is not available." }
					};
				}
				realMethod = method.substring(this._methodPrefix.length);
			}

			switch (realMethod) {
				case ServiceMethod.RATE: {
					if (
						!(
							_.isObjectLike(params)
							&& _.isString(params.marketCurrency)
							&& _.isString(params.tradeCurrency)
							&& (params.date === undefined || _.isString(params.date))
						)
					) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}

					const date = params.date !== undefined ? new Date(params.date) : new Date();
					const ts: number = Number.parseInt(moment(date).format("YYYYMMDDHHMMSS"));
					const marketCurrency = params.marketCurrency;
					const tradeCurrency = params.tradeCurrency;
					//const sourceId = params.exchangeId;
					const requiredAllSourceIds = false;
					const param = { ts, marketCurrency, tradeCurrency, requiredAllSourceIds };
					const result = await this._service.getHistoricalPrices(cancellationToken, [param]);
					const priceResult = priceRuntime.renderForSingle(result, param);
					return { jsonrpc: "2.0", id, result: priceResult };
				}
				// case ServiceMethod.RATEBATCH: {
				// 	if (!_.isArrayLike(params)) {
				// 		return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
				// 	}
				// 	const argsRegex = /^[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+(,[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+)*$/;
				// 	const args: Array<price.Argument> = [];
				// 	for (let i = 0; i < params.length; i++) {
				// 		const arg = params[i];
				// 		if (!argsRegex.test(arg)) {
				// 			return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
				// 		}

				// 		const parts = arg.split(":");
				// 		const ts: number = parseInt(parts[0]);
				// 		const marketCurrency: string = parts[1];
				// 		const tradeCurrency: string = parts[2];
				// 		const sourceId: string | undefined = undefined;
				// 		const requiredAllSourceIds = false;
				// 		args.push({ ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds });
				// 	}

				// 	const result = await this._service.getHistoricalPrices(cancellationToken, args);
				// 	const priceResult = priceRuntime.renderForBatch(result, args);
				// 	return { jsonrpc: "2.0", id, result: priceResult };
				// }
				case ServiceMethod.PING: {
					if (!(_.isObjectLike(params) && _.isString(params.echo))) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}
					const echoMessage: string = params.echo;
					const result = await this._service.ping(cancellationToken, echoMessage);
					return {
						jsonrpc: "2.0", id, result: {
							echo: result.echo,
							time: result.time.toISOString(),
							version: result.version
						}
					};
				}
				case ServiceMethod.SUBSCRIBE: {
					if (!(_.isObjectLike(params) && _.isString(params.topic) && _.isSafeInteger(params.threshold) && params.threshold > 0)) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}
					const opts: any = params.opts;
					switch (params.topic) {
						case SubscribtionTopic.RATE: {
							if (
								!(
									_.isString(opts.marketCurrency)
									&& _.isString(opts.tradeCurrency)
									&& (opts.exchangeId === undefined || _.isString(opts.exchangeId))
								)
							) {
								return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
							}

							//const threshold: number = ensure.integer(params.threshold);
							//const exchangeId: string | undefined = opts.exchangeId;

							const subscriptionChannel = await this._service.createChangeRateSubscriber(
								cancellationToken, opts.marketCurrency, opts.tradeCurrency
							);

							const handle = new PriceTopicSubsciberHandle(opts, subscriptionChannel, this._callbackChannel, this._log,
								`${opts.marketCurrency}:${opts.tradeCurrency}`);

							this._subscribers.set(handle.token, handle);

							return { jsonrpc: "2.0", id, result: handle.token };
						}
						default:
							return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid params." } };
					}
				}
				case ServiceMethod.SUBSCRIPTIONS: {
					const result: { [token: string]: any } = {};
					this._subscribers.forEach((handle, token) => {
						result[token] = { ...handle.opts };
					});
					return { jsonrpc: "2.0", id, result };
				}
				case ServiceMethod.UNSUBSCRIBE: {
					if (!_.isString(params)) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}
					const handle = this._subscribers.get(params/*token*/);
					if (handle === undefined) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}

					this._subscribers.delete(params/*token*/);
					handle.stopSubscriptionEvents();
					await handle.dispose();

					return { jsonrpc: "2.0", id, result: true };
				}
				default:
					return { jsonrpc: "2.0", id, error: { code: -32601, message: "The method does not exist / is not available." } };
			}
		} catch (servireMethodError) {
			// Return correct JSON-RPC error message, instead raise exception
			throw servireMethodError;
		}
	}
}

interface TopicSubsciberHandle extends zxteam.Disposable {
	readonly opts: any;
	stopSubscriptionEvents(): void;
}

abstract class AbstractTopicSubsciberHandle<TEventData> extends Disposable implements TopicSubsciberHandle {
	public readonly opts: any;
	protected readonly _eventHandler: zxteam.SubscriberChannel.Callback<TEventData>;
	protected readonly _log: zxteam.Logger;
	private readonly _publisherChannel: zxteam.PublisherChannel<string>;
	private readonly _token: string;

	public constructor(opts: any, publisherChannel: zxteam.PublisherChannel<string>, log: zxteam.Logger, tokenPrefix?: string) {
		super();
		this.opts = opts;
		this._publisherChannel = publisherChannel;
		this._log = log;
		this._eventHandler = this.onEvent.bind(this);
		if (tokenPrefix === undefined) { tokenPrefix = "token"; }
		this._token = `${tokenPrefix}-${uuid()}`;
	}

	public get token(): string { return this._token; }

	public abstract stopSubscriptionEvents(): void;

	protected abstract formatEventData(data: TEventData): any;

	private async onEvent(
		cancellationToken: zxteam.CancellationToken,
		ev: zxteam.SubscriberChannel.Event<TEventData> | Error
	): Promise<void> {
		if (ev instanceof Error) {
			if (this._log.isWarnEnabled) { this._log.warn(`SubscriberChannel for token ${this._token} fired error: ${ev.message}`); }
			if (this._log.isTraceEnabled) { this._log.warn(`SubscriberChannel for token ${this._token} fired error.`, ev.message); }
			return;
		}

		const data = this.formatEventData(ev.data);
		const jsonRpcMessage = { jsonrpc: "2.0", method: "notification", params: { token: this._token, data } };
		await this._publisherChannel.send(cancellationToken, JSON.stringify(jsonRpcMessage));
	}
}

class PriceTopicSubsciberHandle extends AbstractTopicSubsciberHandle<Notification.ChangeRate.Data> {
	private readonly _priceTopicSubsciberChannel: Notification.ChangeRate.Channel;

	public constructor(
		opts: any,
		priceTopicSubsciberChannel: Notification.ChangeRate.Channel,
		publisherChannel: zxteam.PublisherChannel<string>,
		log: zxteam.Logger,
		tokenPrefix: string
	) {
		super(opts, publisherChannel, log, tokenPrefix);
		this._priceTopicSubsciberChannel = priceTopicSubsciberChannel;

		this._priceTopicSubsciberChannel.addHandler(this._eventHandler);
	}

	public stopSubscriptionEvents() {
		this._priceTopicSubsciberChannel.removeHandler(this._eventHandler);
	}

	protected onDispose() {
		return this._priceTopicSubsciberChannel.dispose();
	}

	protected formatEventData({ date, price: rate }: Notification.ChangeRate.Data): any {
		return {
			date: date.toISOString(),
			price: financial.toString(rate)
		};
	}
}
