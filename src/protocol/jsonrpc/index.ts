import * as zxteam from "@zxteam/contract";
import { ProtocolAdapter } from "@zxteam/webserver";
import * as _ from "lodash";

// import { JsonSchemaManager, factory as jsonSchemaManagerFactory } from "../../misc/JsonSchemaManager";
import * as ArrayBufferUtils from "../../misc/ArrayBufferUtils";
import { PriceService } from "../../PriceService";
import { Task, DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";

export async function factory(
	service: PriceService, logger: zxteam.Logger, methodPrefix?: string
): Promise<ProtocolAdapter> {
	//const schemasDirectory = path.normalize(path.join(__dirname, "schemas"));
	//const schemaManager: JsonSchemaManager = await jsonSchemaManagerFactory(schemasDirectory, logger);

	function handleBinaryMessage(data: ArrayBuffer): zxteam.Task<ArrayBuffer> {
		const objAsBuffer: Buffer = ArrayBufferUtils.toBuffer(data);
		const objAsJsonString: string = objAsBuffer.toString("utf-8");
		return handleTextMessage(objAsJsonString).continue(handleTask => {
			const resultAsString = handleTask.result;
			const resultAsBuffer: Buffer = Buffer.from(resultAsString, "utf-8");
			return ArrayBufferUtils.fromBuffer(resultAsBuffer);
		});
	}
	function handleTextMessage(data: string): zxteam.Task<string> {
		const message = JSON.parse(data);
		return jsonrpcMessageRouter(service, message, methodPrefix).continue(routerTask => {
			const result = routerTask.result;
			return JSON.stringify(result);
		});
	}

	return Object.freeze({ handleBinaryMessage, handleTextMessage });
}

export default factory;


const enum ServiceMethod {
	PING = "ping",
	GETHISTORICALPRICES = "getHistoricalPrices"
}

function jsonrpcMessageRouter(service: PriceService, message: any, methodPrefix?: string): zxteam.Task<any> {
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
			return Task.resolve({
				jsonrpc: "2.0", id: id || null, error: { code: -32600, message: "The JSON sent is not a valid Request object." }
			});
		}

		// Notifications
		// TODO

		// Methods
		if (id === null) {
			// Method call should contain valid id
			return Task.resolve({
				jsonrpc: "2.0", id: id || null, error: { code: -32600, message: "The JSON sent is not a valid Request object." }
			});
		}

		let realMethod = method;
		if (methodPrefix !== undefined) {
			if (!method.startsWith(methodPrefix)) {
				return Task.resolve({
					jsonrpc: "2.0", id, error: { code: -32601, message: "The method does not exist / is not available." }
				});
			}
			realMethod = method.substring(methodPrefix.length);
		}

		switch (realMethod) {
			case ServiceMethod.GETHISTORICALPRICES: {
				if (!(_.isObjectLike(params) && _.isString(params.exchangeId))) {
					return Task.resolve({ jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } });
				}
				const exchangeId: string = params.exchangeId;
				return service.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, exchangeId as any)
					.continue((task: { result: any; }) => ({ jsonrpc: "2.0", id, result: task.result }));
			}
			case ServiceMethod.PING: {
				if (!(_.isObjectLike(params) && _.isString(params.echo))) {
					return Task.resolve({ jsonrpc: "2.0", id, error: { code: -32602, message: "Invalid method parameter(s)." } });
				}
				const echoMessage: string = params.echo;
				return service.ping(DUMMY_CANCELLATION_TOKEN, echoMessage)
					.continue((task: { result: any; }) => ({ jsonrpc: "2.0", id, result: task.result }));
			}
			default:
				return Task.resolve({
					jsonrpc: "2.0", id, error: { code: -32601, message: "The method does not exist / is not available." }
				});
		}
	} catch (servireMethodError) {
		// Return correct JSON-RPC error message, insted raise exception
		throw servireMethodError;
	}
}
