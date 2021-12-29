import { Initable, Logger, Financial } from "@zxteam/contract";
import { InitableMixin } from "@zxteam/disposable";
import { ensureFactory, Ensure, EnsureError } from "@zxteam/ensure";
import rootLogger from "@zxteam/logger";


import * as ioredis from "ioredis";
import { Redis, RedisOptions } from "ioredis";
import * as _ from "lodash";

import { RealtimePriceStream } from "../RealtimePriceStream";
import { AggregateError, wrapErrorIfNeeded } from "@zxteam/errors";
import financial from "@zxteam/financial";

const messageEnsure: Ensure = ensureFactory();

export class CoinGetRecorderRedisSubscriber
	extends RealtimePriceStream
	implements Initable {

	private readonly _ioredis: Redis;
	private readonly _logger: Logger;
	private readonly _channelNameTicker: string = "exchange_stream";
	private readonly _channelNameTrade: string = "exchange_trade_stream";
	private _subsription: boolean | Promise<void>;

	constructor(redisURL: URL) {
		super();
		this._logger = rootLogger.getLogger("RedisStorage");

		const ioredisOpts: RedisOptions = CoinGetRecorderRedisSubscriber.parseRedisURL(redisURL);
		this._ioredis = new ioredis(ioredisOpts);
		this._ioredis.on("message", this._onMessage.bind(this));
		this._subsription = false;
	}

	protected async onInit(): Promise<void> {
		this._logger.trace("Establishing Redis connection.");
		let connectingError: any = null;
		const connectingErrorHandler = (err: any) => { connectingError = err; };
		this._ioredis.on("error", connectingErrorHandler);
		try {
			await this._ioredis.connect();
		} catch (e) {
			if (connectingError !== null) {
				throw new AggregateError([
					wrapErrorIfNeeded(connectingError),
					wrapErrorIfNeeded(e)
				]);
			}
			throw e;
		} finally {
			this._ioredis.removeListener("error", connectingErrorHandler);
		}

		if (this.hasSubscribers && this._subsription === false) {
			this._subsription = this._subscribe();
		}
	}

	protected async onDispose(): Promise<void> {
		this._logger.trace("Closing Redis connection.");
		try {
			await this._ioredis.disconnect();
		} catch (e) {
			// TODO
			this._logger.debug("Redis disconnect was completed with error", e);
			console.error(e);
		}
		this._logger.trace("Redis connection was closed.");
	}

	protected onAddFirstHandler(): void {
		if (this.initialized) {
			if (this._subsription === false) {
				this._subsription = this._subscribe();
			}
		}
	}

	protected onRemoveLastHandler(): void {
		if (this._subsription === true) {
			this._subsription = this._unsubscribe();
		}
	}

	private static parseRedisURL(redisUrl: URL): RedisOptions {
		// TODO Add SSL

		const host = redisUrl.hostname;
		const port = Number(redisUrl.port);
		const db = Number(redisUrl.pathname.slice(1));
		const family: 4 | 6 = redisUrl.searchParams.has("ip_family") && redisUrl.searchParams.get("ip_family") === "6" ? 6 : 4;
		const opts: RedisOptions = {
			host, port, db, family,
			lazyConnect: true
		};

		if (redisUrl.searchParams.has("name")) {
			opts.connectionName = redisUrl.searchParams.get("name") as string;
		}
		if (redisUrl.searchParams.has("prefix")) {
			opts.keyPrefix = redisUrl.searchParams.get("prefix") as string;
		}
		if (redisUrl.searchParams.has("keepAlive")) {
			const keepAliveStr = redisUrl.searchParams.get("keepAlive") as string;
			const keepAlive = Number.parseInt(keepAliveStr);
			if (!Number.isSafeInteger(keepAlive) || keepAlive <= 0) {
				throw new Error(`Wrong keepAlive value: ${keepAliveStr}. Expected positive integer.`);
			}
			opts.keepAlive = keepAlive;
		}

		if (!_.isEmpty(redisUrl.password)) {
			opts.password = redisUrl.password;
		}

		return opts;
	}

	private async _onMessage(channel: string, message: string): Promise<void> {
		let parsedMessage;
		try {
			parsedMessage = JSON.parse(message);
		} catch (e) {
			this._logger.warn(`Cannot parse a message: ${message}`, e);
			return;
		}

		try {
			if (channel === this._channelNameTicker) {

				const friendlyMessage = messageEnsure.object(parsedMessage);
				const friendlySourceSystem: string = messageEnsure.string(friendlyMessage.exchangeName);
				const friendlyTicker: string = messageEnsure.string(friendlyMessage.ticker);
				const friendlyTime: number = messageEnsure.number(friendlyMessage.time);
				const friendlyLastPrice: string | null = messageEnsure.nullableString(friendlyMessage.lastPrice);
				const friendlyClosePrice: string | null = messageEnsure.nullableString(friendlyMessage.closePrice);
				//const friendlyVolume: number = messageEnsure.number(friendlyMessage.volume);

				const friendlyTickerParts = friendlyTicker.split("/");
				if (friendlyTickerParts.length !== 2) {
					throw new EnsureError(`Wrong value of 'ticker': ${friendlyTicker}. Expexted pair: TRADE_CURR/MARKET_CURR`, parsedMessage);
				}

				let friendlyPrice: string;
				if (friendlyLastPrice !== null) {
					friendlyPrice = friendlyLastPrice;
				} else {
					if (friendlyClosePrice !== null) {
						friendlyPrice = friendlyClosePrice;
					} else {
						throw new EnsureError(`Wrong message. Both 'lastPrice' and 'closePrice' are null`, parsedMessage);
					}
				}

				const sourceSystem: string = friendlySourceSystem.toUpperCase();
				const date: Date = new Date(friendlyTime);
				const marketCurrency: string = friendlyTickerParts[1].toUpperCase();
				const tradeCurrency: string = friendlyTickerParts[0].toUpperCase();
				const price: Financial = financial.parse(friendlyPrice);

				const data: RealtimePriceStream.Notification = Object.freeze({
					sourceSystem, date, marketCurrency, price, tradeCurrency
				});

				await this.notify({ data });

			} else if (channel === this._channelNameTrade) {
				const friendlyMessage = messageEnsure.object(parsedMessage);
				const friendlySourceSystem: string = messageEnsure.string(friendlyMessage.exchangeName);
				const friendlyTicker: string = messageEnsure.string(friendlyMessage.ticker);
				const friendlyTime: number = messageEnsure.number(friendlyMessage.time);
				const friendlyPrice: string = messageEnsure.string(friendlyMessage.price);
				//const friendlyVolume: number = messageEnsure.number(friendlyMessage.volume);
				//			{ "exchangeName": "Bittrex", "ticker": "PAX/USDT", "time": 1581864552390, "price": 0.00002713, "volume": 100 }

				const friendlyTickerParts = friendlyTicker.split("/");
				if (friendlyTickerParts.length !== 2) {
					throw new EnsureError(`Wrong value of 'ticker': ${friendlyTicker}. Expexted pair: TRADE_CURR/MARKET_CURR`, parsedMessage);
				}

				const sourceSystem: string = friendlySourceSystem.toUpperCase();
				const date: Date = new Date(friendlyTime);
				const marketCurrency: string = friendlyTickerParts[1].toUpperCase();
				const tradeCurrency: string = friendlyTickerParts[0].toUpperCase();
				const price: Financial = financial.parse(friendlyPrice);

				const data: RealtimePriceStream.Notification = Object.freeze({
					sourceSystem, date, marketCurrency, tradeCurrency, price
				});

				await this.notify({ data });
			} else {
				this._logger.error(`Unsupported channel: ${channel}`);
			}
		} catch (e) {
			this._logger.error(`Failed to process the message`, e);
		}
	}

	private async _subscribe(): Promise<void> {
		try {
			await this._ioredis.subscribe(this._channelNameTicker, this._channelNameTrade);
			if (this.hasSubscribers) {
				this._subsription = true;
			} else {
				// Unsubscribe, due all Subscribers detached while subscribing
				this._subsription = this._unsubscribe();
			}
		} catch (e) {
			this._subsription = false;
			this._logger.fatal("Failed to unsubscribe.", e);
		}
	}

	private async _unsubscribe(): Promise<void> {
		try {
			await this._ioredis.unsubscribe(this._channelNameTicker, this._channelNameTrade);
			if (this.hasSubscribers) {
				// Resubscribe, due new Subscribers attached while unsubscribing
				this._subsription = this._subscribe();
			} else {
				this._subsription = false;
			}
		} catch (e) {
			this._subsription = true;
			this._logger.fatal("Failed to unsubscribe.", e);
		}
	}
}
export interface CoinGetRecorderRedisSubscriber extends InitableMixin { }
InitableMixin.applyMixin(CoinGetRecorderRedisSubscriber);

