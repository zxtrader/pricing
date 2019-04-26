import { Redis, RedisOptions } from "ioredis";
import * as RedisClient from "ioredis";
import { StorageProvider as StorageProviderInerface } from "./contract";
import { CancellationToken, Task as TaskLike, Logger } from "@zxteam/contract";
import { Task } from "ptask.js";
import { price } from "../../index";
import { Disposable } from "@zxteam/disposable";

export class RedisStorageProvider extends Disposable implements StorageProviderInerface {
	private readonly PRICE_PREFIX = "PRICE:PREFIX";
	private readonly ioredis: Redis;
	private readonly _logger: Logger;
	constructor(opts: RedisOptions, logger: Logger) {
		super();
		this.ioredis = new RedisClient(opts);
		this._logger = logger;
	}

	public filterEmptyPrices(cancellationToken: CancellationToken, args: Array<price.Argument>, sources: Array<string>)
		: TaskLike<Array<price.LoadDataRequest>> {
		return Task.run(async (ct) => {
			const friendlyRequest: Array<price.LoadDataRequest> = [];
			for (let i = 0; i < args.length; i++) {
				const arg = args[i];
				const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds: requiredAllSourceSystems } = arg;
				const corePriceRedisKey = `${this.PRICE_PREFIX}:${ts}:${marketCurrency}:${tradeCurrency}`;
				if (sourceId) {
					const priceSourceIdRedisKey = `${corePriceRedisKey}:${sourceId}`;
					const sourceIdPrice = await this.ioredis.hget(priceSourceIdRedisKey, "price");
					if (!sourceIdPrice) {
						friendlyRequest.push({
							sourceId,
							ts,
							marketCurrency,
							tradeCurrency,
							price: null
						});
					}
				} else {
					for (let n = 0; n < sources.length; n++) {
						const sourceNameId = sources[n];
						const priceSourceSystemsRedisKey = `${corePriceRedisKey}:${sourceNameId}`;
						const sourceSystemPrice = await this.ioredis.hget(priceSourceSystemsRedisKey, "price");
						if (!sourceSystemPrice) {
							friendlyRequest.push({
								sourceId: sourceNameId,
								ts,
								marketCurrency,
								tradeCurrency,
								price: null
							});
						}
					}
				}
			}
			return friendlyRequest;
		}, cancellationToken);
	}

	public savePrices(cancellationToken: CancellationToken, newPrices: Array<price.HistoricalPrices>): TaskLike<void> {
		return Task.run(async (ct) => {
			for (let n = 0; n < newPrices.length; n++) {
				const argNewPrice = newPrices[n];

				const { sourceId, ts, marketCurrency, tradeCurrency, price: newPrice } = argNewPrice;

				const corePriceRedisKey = `${this.PRICE_PREFIX}:${ts}:${marketCurrency}:${tradeCurrency}`;
				const priceSourceIdsRedisKey = `${corePriceRedisKey}:`;
				const sourceIdPriceRedisKey = `${priceSourceIdsRedisKey}${sourceId}`;

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Save price by sourceId");
					this._logger.trace("Execute: HSET", sourceIdPriceRedisKey, "price", newPrice);
				}
				await this.ioredis.hset(sourceIdPriceRedisKey, "price", newPrice);

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Check count sourceId");
					this._logger.trace("Execute: LLEN", priceSourceIdsRedisKey);
				}
				const redisPriceSourceIdCount = await this.ioredis.llen(priceSourceIdsRedisKey);

				let totalSum: number = 0;

				if (redisPriceSourceIdCount) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace("Get list sourceId");
						this._logger.trace("Execute: LRANGE", priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);
					}
					const sourceIds = await this.ioredis.lrange(priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);

					for (let x = 0; x < sourceIds.length; x++) {
						const source = sourceIds[x];
						const sourceIdAvgRedisKey = `${priceSourceIdsRedisKey}${source}`;
						if (this._logger.isTraceEnabled) {
							this._logger.trace("Execute: HGET", sourceIdAvgRedisKey, "price");
						}
						const sourceIdPrice = await this.ioredis.hget(sourceIdAvgRedisKey, "price");
						if (sourceIdPrice) {
							totalSum += parseFloat(sourceIdPrice);
						}
					}
				}

				const avgPrice = (totalSum + newPrice) / (redisPriceSourceIdCount + 1);

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Save new avg price");
					this._logger.trace("Execute: HSET", corePriceRedisKey, "price", avgPrice);
				}
				await this.ioredis.hset(corePriceRedisKey, "price", avgPrice);

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Save sourceId as key");
					this._logger.trace("Execute: LPUSH", priceSourceIdsRedisKey, sourceId);
				}
				await this.ioredis.lpush(priceSourceIdsRedisKey, sourceId);
			}

		}, cancellationToken);
	}

	public findPrices(cancellationToken: CancellationToken, args: Array<price.Argument>): TaskLike<price.Timestamp> {
		return Task.run(async (ct) => {
			this._logger.trace("Begin find price in redis database");

			const friendlyPricesChunk: price.Timestamp = {};

			if (this._logger.isTraceEnabled) {
				this._logger.trace("Foreach args: ", args);
			}
			for (let i = 0; i < args.length; i++) {
				const arg = args[i];
				if (this._logger.isTraceEnabled) {
					this._logger.trace("List atr in arg: ", arg);
				}

				const { ts, marketCurrency, tradeCurrency, sourceId: sourceId, requiredAllSourceIds: requiredAllSourceId } = arg;
				const corePriceRedisKey = `${this.PRICE_PREFIX}:${ts}:${marketCurrency}:${tradeCurrency}`;
				const priceSourceIdsRedisKey = `${corePriceRedisKey}:`;

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Save price by sourceId");
					this._logger.trace("Execute: HGET", corePriceRedisKey, "price");
				}
				const avgPrice = await this.ioredis.hget(corePriceRedisKey, "price");

				helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, avgPrice);

				if (sourceId) {
					const priceSourceIdRedisKey = `${corePriceRedisKey}:${sourceId}`;

					if (this._logger.isTraceEnabled) {
						this._logger.trace("Get price by sourceId");
						this._logger.trace("Execute: HGET", priceSourceIdRedisKey, "price");
					}
					const sourceIdPrice = await this.ioredis.hget(priceSourceIdRedisKey, "price");

					helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, sourceId, sourceIdPrice);

				} else if (requiredAllSourceId) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace("Check count sourceId");
						this._logger.trace("Execute: LLEN", priceSourceIdsRedisKey);
					}
					const redisPriceSourceIdCount = await this.ioredis.llen(priceSourceIdsRedisKey);

					if (redisPriceSourceIdCount) {
						if (this._logger.isTraceEnabled) {
							this._logger.trace("Get list sourceId");
							this._logger.trace("Execute: LRANGE", priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);
						}
						const sourceIds = await this.ioredis.lrange(priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);

						for (let x = 0; x < sourceIds.length; x++) {
							const source = sourceIds[x];
							const sourceIdAvgRedisKey = `${priceSourceIdsRedisKey}${source}`;
							if (this._logger.isTraceEnabled) {
								this._logger.trace("Execute: HGET", sourceIdAvgRedisKey, "price");
							}
							const sourceIdPrice = await this.ioredis.hget(sourceIdAvgRedisKey, "price");

							helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, source, sourceIdPrice);
						}
					}
				}
			}
			return friendlyPricesChunk;
		}, cancellationToken);
	}
	protected async onDispose(): Promise<void> {
		this._logger.trace("Disposing");
		// await this.dispose();
		await this.ioredis.disconnect();
		this._logger.trace("Disposed");
	}
}



export interface RedisOpts {
	port: number;
	host: string;
	family: number;
	password: string;
	db: string;
}
export namespace helpers {
	export function addPriceTimeStamp(
		friendlyPrices: price.Timestamp,
		ts: number,
		marketCurrency: string,
		tradeCurrency: string,
		avgPrice?: string | null,
		sourceId?: string,
		sourcePrice?: string | null
	): price.Timestamp {
		if (!(ts in friendlyPrices)) {
			friendlyPrices[ts] = {};
		}
		if (!(marketCurrency in friendlyPrices[ts])) {
			friendlyPrices[ts][marketCurrency] = {};
		}
		if ((avgPrice) && !(tradeCurrency in friendlyPrices[ts][marketCurrency])) {
			friendlyPrices[ts][marketCurrency][tradeCurrency] = {
				avg: {
					price: avgPrice
				}
			};
		}
		if ((sourceId) && (sourcePrice) && !(sourceId in friendlyPrices[ts][marketCurrency][tradeCurrency])) {
			if (!("sources" in friendlyPrices[ts][marketCurrency][tradeCurrency])) {
				friendlyPrices[ts][marketCurrency][tradeCurrency].sources = {};
			}
			friendlyPrices[ts][marketCurrency][tradeCurrency].sources =
				Object.assign(
					friendlyPrices[ts][marketCurrency][tradeCurrency].sources,
					{
						[sourceId]: {
							price: sourcePrice
						}
					});
			// friendlyPrices[ts][marketCurrency][tradeCurrency].sources = {
			// 	[sourceId]: {
			// 		price: sourcePrice
			// 	}
			// };
		}
		return friendlyPrices;
	}
}
