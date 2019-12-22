import { CancellationToken, Disposable as DisposableLike, Financial, Logger, SubscriberChannel, PublisherChannel } from "@zxteam/contract";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/cancellation";
import { Disposable } from "@zxteam/disposable";
import financial from "@zxteam/financial";
import { SubscriberChannelMixin } from "@zxteam/channels";
import { Ensure, EnsureError, ensureFactory } from "@zxteam/ensure";
import { InvalidOperationError } from "@zxteam/errors";
import logger from "@zxteam/logger";
import { JsonRpcHost, Notification, Request, Response } from "@zxteam/jsonrpc";

import { v4 as uuid } from "uuid";

import { PriceService } from "../api/PriceService";


const ensure: Ensure = ensureFactory();

export class PriceApiJsonRpcHost extends Disposable implements JsonRpcHost {
	private readonly _priceService: PriceService;
	private readonly _subscribers: Map<string/* token */, {
		channel: PriceService.ChangeRateNotification.Channel; disposer: () => Promise<void>;
	}>;

	public constructor(priceService: PriceService) {
		super();
		this._priceService = priceService;
		this._subscribers = new Map();
	}

	public async invoke(cancellationToken: CancellationToken, args: Request): Promise<Response> {
		const { jsonrpc, id, method, params } = args;
		switch (method) {
			case "ping": {
				const echo = ensure.string((ensure.defined(params) as any).echo);
				const pingResult = await this._priceService.ping(cancellationToken, echo);
				return { jsonrpc, id, "result": pingResult };
			}
			case "subscribe": {
				const topic = ensure.string((ensure.defined(params) as any).topic);
				if (topic === "rate") {
					const threshold = ensure.integer((ensure.defined(params) as any).threshold);
					const opts = ensure.defined((ensure.defined(params) as any).opts);
					const marketCurrency = ensure.string(opts.marketCurrency);
					const tradeCurrency = ensure.string(opts.tradeCurrency);

					const token = `token-${uuid()}`;

					const channel = await this._priceService.createChangeRateSubscriber(
						cancellationToken, marketCurrency, tradeCurrency
					);

					const handler = (event: PriceService.ChangeRateNotification.Event | Error) => {
						if (event instanceof Error) { return; }
						const data = event.data;
						return this.notify({ data: { jsonrpc: "2.0", method: "notification", params: { token, data } } });
					};
					async function disposer(): Promise<void> {
						channel.removeHandler(handler);
						await channel.dispose();
					}

					channel.addHandler(handler);

					this._subscribers.set(token, { channel, disposer });

					return { jsonrpc, id, result: token };

				}
				return { jsonrpc, id, error: { code: 400, message: `Wrong topic: ${topic}` } } as any;
			}
			default:
				throw new InvalidOperationError(`Wrong method name '${method}'`);
		}
	}

	protected async onDispose() {
		const values = [...this._subscribers.values()];
		this._subscribers.clear();
		for (const channelHandle of values) {
			await channelHandle.disposer();
		}
	}
}
export interface PriceApiJsonRpcHost extends SubscriberChannelMixin<Notification> { }
SubscriberChannelMixin.applyMixin(PriceApiJsonRpcHost);




interface TopicSubsciberHandle extends DisposableLike {
	readonly opts: any;
	stopSubscriptionEvents(): void;
}

abstract class AbstractTopicSubsciberHandle<TEventData> extends Disposable implements TopicSubsciberHandle {
	public readonly opts: any;
	protected readonly _eventHandler: SubscriberChannel.Callback<TEventData>;
	protected readonly _log: Logger;
	private readonly _publisherChannel: PublisherChannel<string>;
	private readonly _token: string;

	public constructor(opts: any, publisherChannel: PublisherChannel<string>, log: Logger, tokenPrefix?: string) {
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

	private async onEvent(ev: SubscriberChannel.Event<TEventData> | Error): Promise<void> {
		if (ev instanceof Error) {
			if (this._log.isWarnEnabled) { this._log.warn(`SubscriberChannel for token ${this._token} fired error: ${ev.message}`); }
			if (this._log.isTraceEnabled) { this._log.warn(`SubscriberChannel for token ${this._token} fired error.`, ev.message); }
			return;
		}

		const data = this.formatEventData(ev.data);
		const jsonRpcMessage = { jsonrpc: "2.0", method: "notification", params: { token: this._token, data } };
		await this._publisherChannel.send(DUMMY_CANCELLATION_TOKEN, JSON.stringify(jsonRpcMessage));
	}
}

class PriceTopicSubsciberHandle extends AbstractTopicSubsciberHandle<PriceService.ChangeRateNotification.Data> {
	private readonly _priceTopicSubsciberChannel: PriceService.ChangeRateNotification.Channel;

	public constructor(
		opts: any,
		priceTopicSubsciberChannel: PriceService.ChangeRateNotification.Channel,
		publisherChannel: PublisherChannel<string>,
		log: Logger,
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
		//return this._priceTopicSubsciberChannel.dispose();
	}

	protected formatEventData({ date, price: rate }: PriceService.ChangeRateNotification.Data): any {
		return {
			date: date.toISOString(),
			price: rate
		};
	}
}
