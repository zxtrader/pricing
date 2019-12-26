import { CancellationToken, Logger } from "@zxteam/contract";
import { wrapErrorIfNeeded, ArgumentError } from "@zxteam/errors";
import { Configuration as HostingConfiguration, WebServer, WebSocketChannelFactoryEndpoint } from "@zxteam/hosting";
import { JsonRpcHostChannel } from "@zxteam/jsonrpc";

import * as WebSocket from "ws";

import { PriceApi } from "../api/PriceApi";
import { PriceApiJsonRpcHost } from "./PriceApiJsonRpcHost";

export class WebSocketEndpoint extends WebSocketChannelFactoryEndpoint {
	private readonly _priceApi: PriceApi;

	public constructor(
		priceApi: PriceApi,
		servers: ReadonlyArray<WebServer>,
		opts: HostingConfiguration.WebSocketEndpoint,
		log: Logger
	) {
		super(servers, opts, log);
		this._priceApi = priceApi;
	}

	protected async createTextChannel(
		cancellationToken: CancellationToken, webSocket: WebSocket, subProtocol: string
	): Promise<WebSocketChannelFactoryEndpoint.TextChannel> {
		const host = new PriceApiJsonRpcHost(this._priceApi);
		return new JsonRpcHostChannel(host, async () => {
			await host.dispose();
		});
	}
}

