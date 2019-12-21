import { CancellationToken, Logger } from "@zxteam/contract";
import { wrapErrorIfNeeded, ArgumentError } from "@zxteam/errors";
import { Configuration as HostingConfiguration, ServersBindEndpoint, WebServer, WebSocketChannelFactoryEndpoint } from "@zxteam/hosting";
import { JsonRpcHostChannel } from "@zxteam/jsonrpc";

import * as express from "express";
import * as bodyParser from "body-parser";
import * as WebSocket from "ws";
import { PriceApi } from "../api/PriceApi";
import { PriceApiJsonRpcHost } from "./PriceApiJsonRpcHost";

export class WebSocketEndpoint extends WebSocketChannelFactoryEndpoint {
	private readonly _api: PriceApi;

	public constructor(api: PriceApi, servers: ReadonlyArray<WebServer>, opts: HostingConfiguration.WebSocketEndpoint, log: Logger) {
		super(servers, opts, log);
		this._api = api;
	}

	protected async createTextChannel(
		cancellationToken: CancellationToken, webSocket: WebSocket, subProtocol: string
	): Promise<WebSocketChannelFactoryEndpoint.TextChannel> {
		const host = new PriceApiJsonRpcHost(this._api);
		return new JsonRpcHostChannel(host, () => {
			// nothing to dispose right now
		});
	}
}

