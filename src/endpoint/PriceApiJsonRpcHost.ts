import { CancellationToken, Financial, Logger } from "@zxteam/contract";
import { SubscriberChannelMixin } from "@zxteam/channels";
import { InvalidOperationError } from "@zxteam/errors";
import { JsonRpcHost, Notification, Request, Response } from "@zxteam/jsonrpc";

import { PriceApi } from "../api/PriceApi";

export class PriceApiJsonRpcHost implements JsonRpcHost {
	private readonly _api: PriceApi;
	public constructor(api: PriceApi) {
		this._api = api;
	}

	public async invoke(cancellationToken: CancellationToken, args: Request): Promise<Response> {
		const { jsonrpc, id, method, params } = args;
		switch (method) {
			default:
				throw new InvalidOperationError(`Wrong method name '${method}'`);
		}
	}
}
export interface PriceApiJsonRpcHost extends SubscriberChannelMixin<Notification> { }
SubscriberChannelMixin.applyMixin(PriceApiJsonRpcHost);
