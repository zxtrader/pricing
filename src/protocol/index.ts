import * as zxteam from "@zxteam/contract";
import { ProtocolAdapter } from "@zxteam/webserver";

import jsonrpcProtocolAdapterFactory from "./jsonrpc/index";
import { PriceService } from "../PriceService";

export const enum ProtocolType {
	JSONRPC = "jsonrpc",
	PROTOBUF = "protobuf"
}

export const ProtocolTypes: ReadonlyArray<ProtocolType> = Object.freeze([ProtocolType.JSONRPC, ProtocolType.PROTOBUF]);

export async function factory(
	service: PriceService,
	protocolType: ProtocolType,
	logger: zxteam.Logger,
	methodPrefix?: string
): Promise<ProtocolAdapter> {
	switch (protocolType) {
		case ProtocolType.JSONRPC: return jsonrpcProtocolAdapterFactory(service, logger, methodPrefix);
		case ProtocolType.PROTOBUF: return Promise.resolve(Object.freeze({
			handleBinaryMessage() { throw new Error("Not implemented yet"); },
			handleTextMessage() { throw new Error("Not implemented yet"); }
		}));
		default: throw new UnreachableProtocolTypeError(protocolType);
	}
}

export class UnreachableProtocolTypeError extends Error {
	public constructor(protocolType: never) {
		super(`Unsupported ProtocolType: ${protocolType}`);
	}
}

export default factory;
