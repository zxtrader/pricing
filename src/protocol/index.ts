import * as zxteam from "@zxteam/contract";
import { ProtocolAdapter } from "@zxteam/webserver";

import { factory as jsonRpcProtocolAdapterFactoryInitializer } from "./jsonrpc/index";
import { PriceService } from "../PriceService";

export const enum ProtocolType {
	JSONRPC = "jsonrpc",
	PROTOBUF = "protobuf"
}

export const TextProtocolTypes: ReadonlyArray<ProtocolType> = Object.freeze([ProtocolType.JSONRPC]);
export const BinaryProtocolTypes: ReadonlyArray<ProtocolType> = Object.freeze([ProtocolType.PROTOBUF]);

export interface ProtocolAdapterFactory {
	createBinaryProtocolAdapter(
		protocol: ProtocolType,
		callbackChannel: zxteam.PublisherChannel<ArrayBuffer>,
		methodPrefix?: string
	): ProtocolAdapter<ArrayBuffer>;
	createTextProtocolAdapter(
		protocol: ProtocolType,
		callbackChannel: zxteam.PublisherChannel<string>,
		methodPrefix?: string
	): ProtocolAdapter<string>;
}

export async function factory(service: PriceService, log: zxteam.Logger): Promise<ProtocolAdapterFactory> {
	const jsonRpcProtocolAdapterFactory = await jsonRpcProtocolAdapterFactoryInitializer(service, log);

	function createBinaryProtocolAdapter(
		protocol: ProtocolType,
		callbackChannel: zxteam.PublisherChannel<ArrayBuffer>,
		methodPrefix?: string
	): ProtocolAdapter<ArrayBuffer> {
		throw new Error("Not implemnted yet");
	}

	function createTextProtocolAdapter(
		protocol: ProtocolType,
		callbackChannel: zxteam.PublisherChannel<string>,
		methodPrefix?: string
	): ProtocolAdapter<string> {
		switch (protocol) {
			case ProtocolType.JSONRPC:
				return jsonRpcProtocolAdapterFactory(callbackChannel, methodPrefix);
			case ProtocolType.PROTOBUF:
				throw new Error("Protobuf protocol is not TextProtocolAdapter.");
			default:
				throw new UnreachableProtocolTypeError(protocol);
		}
	}

	const impl: ProtocolAdapterFactory = { createBinaryProtocolAdapter, createTextProtocolAdapter };
	return impl;
}

export class UnreachableProtocolTypeError extends Error {
	public constructor(protocolType: never) {
		super(`Unsupported ProtocolType: ${protocolType}`);
	}
}

export default factory;
