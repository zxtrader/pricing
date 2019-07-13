import * as zxteam from "@zxteam/contract";
import { AbstractProtocolAdapter, ProtocolAdapter } from "@zxteam/webserver";
import * as _ from "lodash";

// import { JsonSchemaManager, factory as jsonSchemaManagerFactory } from "../../misc/JsonSchemaManager";
import * as ArrayBufferUtils from "../../misc/ArrayBufferUtils";
import { PriceService, price } from "../../PriceService";
import { Task } from "@zxteam/task";
import { priceRuntime } from "../../endpoints";

export interface JsonRpcProtocolAdapterFactory {
	(callbackChannel: zxteam.PublisherChannel<string>, methodPrefix?: string): ProtocolAdapter<string>;
}

export async function factory(service: PriceService, logger: zxteam.Logger): Promise<JsonRpcProtocolAdapterFactory> {
	//const schemasDirectory = path.normalize(path.join(__dirname, "schemas"));
	//const schemaManager: JsonSchemaManager = await jsonSchemaManagerFactory(schemasDirectory, logger);

	// function handleBinaryMessage(
	// 	ct: zxteam.CancellationToken, data: ArrayBuffer, next?: ProtocolAdapterNext<ArrayBuffer>
	// ): zxteam.Task<ArrayBuffer> {
	// 	const objAsBuffer: Buffer = ArrayBufferUtils.toBuffer(data);
	// 	const objAsJsonString: string = objAsBuffer.toString("utf-8");
	// 	const nextWrapper = next !== undefined ?
	// 		(): zxteam.Task<string> => {
	// 			return next(ct, data).continue(nextTask => {
	// 				const nextObjAsBuffer: Buffer = ArrayBufferUtils.toBuffer(nextTask.result);
	// 				const nextObjAsJsonString: string = nextObjAsBuffer.toString("utf-8");
	// 				return nextObjAsJsonString;
	// 			});
	// 		}
	// 		: undefined;
	// 	return handleTextMessage(ct, objAsJsonString, nextWrapper).continue(handleTask => {
	// 		const resultAsString = handleTask.result;
	// 		const resultAsBuffer: Buffer = Buffer.from(resultAsString, "utf-8");
	// 		return ArrayBufferUtils.fromBuffer(resultAsBuffer);
	// 	});
	// }
	// function handleTextMessage(
	// 	ct: zxteam.CancellationToken, data: string, next?: ProtocolAdapterNext<string>
	// ): zxteam.Task<string> {
	// 	const message = JSON.parse(data);
	// 	return jsonrpcMessageRouter(ct, service, message).continue(routerTask => {
	// 		const result = routerTask.result;
	// 		if (result.error && result.error.code === -32601) {
	// 			if (next !== undefined) {
	// 				return next(ct, data);
	// 			}
	// 		}
	// 		return JSON.stringify(result);
	// 	});
	// }

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
	RATESINGLE = "single",
	RATEBATCH = "batch",
	SUBSCRIBE = "subscribe",
	SUBSCRIPTIONS = "subsсiptions",
	UNSUBSCRIBE = "unsubscribe"
}

// function jsonrpcMessageRouter(
// 	cancellationToken: zxteam.CancellationToken, service: PriceService, message: any, methodPrefix?: string
// ): zxteam.Task<any> {
// }



class JsonRpcProtocolAdapter extends AbstractProtocolAdapter<string> {
	private readonly _service: PriceService;
	private readonly _methodPrefix?: string;

	public constructor(
		service: PriceService, callbackChannel: ProtocolAdapter.CallbackChannel<string>, log: zxteam.Logger, methodPrefix?: string
	) {
		super(callbackChannel, log);
		this._service = service;
		this._methodPrefix = methodPrefix;
	}

	public async handleMessage(
		cancellationToken: zxteam.CancellationToken, data: string, next?: ProtocolAdapter.Next<string>
	): Promise<string> {
		const message = JSON.parse(data);
		const result = await this.handleJsonRpcMessage(cancellationToken, message);
		return JSON.stringify(result);
	}

	protected onDispose(): void {
		//
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
				return {
					jsonrpc: "2.0", id: id || null, error: { code: -32600, message: "The JSON sent is not a valid Request object." }
				};
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
				case ServiceMethod.RATESINGLE: {
					if (!(_.isObjectLike(params)
						&& _.isString(params.exchange)
						&& _.isString(params.market)
						&& _.isString(params.trade)
						&& _.isString(params.date)
					)) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}
					const ts = +params.date;
					const marketCurrency = params.market;
					const tradeCurrency = params.trade;
					const sourceId = params.exchange;
					const requiredAllSourceIds = false;
					const param = { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds };
					const result = await this._service.getHistoricalPrices(cancellationToken, [param]);
					const priceResult = priceRuntime.renderForSingle(result, param);
					return { jsonrpc: "2.0", id, result: priceResult };
				}
				case ServiceMethod.RATEBATCH: {
					if (!_.isArrayLike(params)) {
						return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
					}
					const argsRegex = /^[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+(,[0-9]{14}:[0-9A-Z]+:[0-9A-Z]+)*$/;
					const args: Array<price.Argument> = [];
					for (let i = 0; i < params.length; i++) {
						const arg = params[i];
						if (!argsRegex.test(arg)) {
							return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
						}

						const parts = arg.split(":");
						const ts: number = parseInt(parts[0]);
						const marketCurrency: string = parts[1];
						const tradeCurrency: string = parts[2];
						const sourceId: string | undefined = undefined;
						const requiredAllSourceIds = false;
						args.push({ ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds });
					}

					const result = await this._service.getHistoricalPrices(cancellationToken, args);
					const priceResult = priceRuntime.renderForBatch(result, args);
					return { jsonrpc: "2.0", id, result: priceResult };
				}
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
						case "rate": {
							if (!(_.isString(opts.marketCurrency) && _.isString(opts.tradeCurrency) && _.isString(opts.exchangeId))) {
								return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } };
							}

							// { "topic": "rate", "threshold": 250, "opts": { "marketCurrency": "USD", "tradeCurrency": "BTC", "exchange": "BINANCE" } }
							const channel = await this._service.createChangeRateSubscriber(
								cancellationToken, opts.exchangeId, opts.marketCurrency, opts.tradeCurrency
							);
							//channel.addHandler()
							return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid params." } };
						}
						default:
							return { jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid params." } };
					}
				}
				case ServiceMethod.SUBSCRIPTIONS: {
					return { jsonrpc: "2.0", id, error: { code: -32601, message: "The method does not exist / is not available." } };
				}
				case ServiceMethod.UNSUBSCRIBE: {
					return { jsonrpc: "2.0", id, error: { code: -32601, message: "The method does not exist / is not available." } };
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
