import { Task } from "@zxteam/task";
import { price } from "../../PriceService";
import * as RedisClient from "ioredis";
import loggerFactory from "@zxteam/logger";
import * as zxteam from "@zxteam/contract";
import { Redis, RedisOptions } from "ioredis";
import { Initable } from "@zxteam/disposable";
import { StorageProvider as StorageProviderInerface } from "./contract";

export class RedisStorageProvider extends Initable implements StorageProviderInerface {
	private readonly PRICE_PREFIX = "PRICE:PREFIX";
	private readonly ioredis: Redis;
	private readonly _logger = loggerFactory.getLogger("RedisStorage");
	constructor(opts: RedisOptions) {
		super();
		opts.lazyConnect = true;
		this.ioredis = new RedisClient(opts);
	}

	public filterEmptyPrices(cancellationToken: zxteam.CancellationToken, args: Array<price.Argument>, sources: Array<string>)
		: zxteam.Task<Array<price.LoadDataRequest>> {
		return Task.run(async (ct) => {
			this._logger.trace("filterEmptyPrices()... ");
			const friendlyRequest: Array<price.LoadDataRequest> = [];
			for (let i = 0; i < args.length; i++) {
				const arg = args[i];
				const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds: requiredAllSourceSystems } = arg;

				this._logger.trace("Create keys for search price");
				const corePriceRedisKey = `${this.PRICE_PREFIX}:${ts}:${marketCurrency}:${tradeCurrency}`;

				if (sourceId) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Serach price for source: ${sourceId}`);
					}

					this._logger.trace("Create keys for search price");
					const priceSourceIdRedisKey = `${corePriceRedisKey}:${sourceId}`;

					if (this._logger.isTraceEnabled) {
						this._logger.trace("Execute: HGET", priceSourceIdRedisKey, "price");
					}
					const sourceIdPrice = await this.ioredis.hget(priceSourceIdRedisKey, "price");

					this._logger.trace("Check cancellationToken for interrupt");
					ct.throwIfCancellationRequested();

					if (!sourceIdPrice) {
						this._logger.trace("Formatting data and push to friendly array");
						friendlyRequest.push({
							sourceId,
							ts,
							marketCurrency,
							tradeCurrency
						});
					}
				} else {
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Serach price for all source: ${sources}`);
					}

					for (let n = 0; n < sources.length; n++) {
						const sourceNameId = sources[n];
						if (this._logger.isTraceEnabled) {
							this._logger.trace(`Serach price for source: ${sourceNameId}`);
						}

						this._logger.trace("Create keys for search price");
						const priceSourceSystemsRedisKey = `${corePriceRedisKey}:${sourceNameId}`;

						if (this._logger.isTraceEnabled) {
							this._logger.trace("Execute: HGET", priceSourceSystemsRedisKey, "price");
						}
						const sourceSystemPrice = await this.ioredis.hget(priceSourceSystemsRedisKey, "price");

						this._logger.trace("Check cancellationToken for interrupt");
						ct.throwIfCancellationRequested();

						if (!sourceSystemPrice) {
							this._logger.trace("Formatting data and push to friendly array");
							friendlyRequest.push({
								sourceId: sourceNameId,
								ts,
								marketCurrency,
								tradeCurrency
							});
						}
					}
				}
			}
			return friendlyRequest;
		}, cancellationToken);
	}

	public savePrices(cancellationToken: zxteam.CancellationToken, newPrices: Array<price.HistoricalPrices>): zxteam.Task<void> {
		return Task.run(async (ct) => {
			this._logger.trace("savePrices()...");
			for (let n = 0; n < newPrices.length; n++) {
				const argNewPrice = newPrices[n];

				const { sourceId, ts, marketCurrency, tradeCurrency, price: newPrice } = argNewPrice;

				this._logger.trace("Create keys for save price");
				const corePriceRedisKey = `${this.PRICE_PREFIX}:${ts}:${marketCurrency}:${tradeCurrency}`;
				const priceSourceIdsRedisKey = `${corePriceRedisKey}:`;
				const sourceIdPriceRedisKey = `${priceSourceIdsRedisKey}${sourceId}`;

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Save price by sourceId");
					this._logger.trace("Execute: HSET", sourceIdPriceRedisKey, "price", newPrice);
				}
				await this.ioredis.hset(sourceIdPriceRedisKey, "price", newPrice);

				// We can't use cancellationToken, need calculating avg price and save in database.

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Check count sourceId");
					this._logger.trace("Execute: LLEN", priceSourceIdsRedisKey);
				}
				const redisPriceSourceIdCount = await this.ioredis.llen(priceSourceIdsRedisKey);

				// We can't use cancellationToken, need calculating avg price and save in database.

				let totalSum: number = 0;

				if (redisPriceSourceIdCount) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace("Get list sourceId");
						this._logger.trace("Execute: LRANGE", priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);
					}
					const sourceIds = await this.ioredis.lrange(priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);

					// We can't use cancellationToken, need calculating avg price and save in database.

					for (let x = 0; x < sourceIds.length; x++) {
						const source = sourceIds[x];
						const sourceIdAvgRedisKey = `${priceSourceIdsRedisKey}${source}`;
						if (this._logger.isTraceEnabled) {
							this._logger.trace("Execute: HGET", sourceIdAvgRedisKey, "price");
						}
						const sourceIdPrice = await this.ioredis.hget(sourceIdAvgRedisKey, "price");

						// We can't use cancellationToken, need calculating avg price and save in database.

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

				// We can't use cancellationToken, need calculating avg price and save in base.

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Save sourceId as key");
					this._logger.trace("Execute: LPUSH", priceSourceIdsRedisKey, sourceId);
				}
				await this.ioredis.lpush(priceSourceIdsRedisKey, sourceId);
			}

		}, cancellationToken);
	}

	public findPrices(cancellationToken: zxteam.CancellationToken, args: Array<price.Argument>): zxteam.Task<price.Timestamp> {
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

				this._logger.trace("Check cancellationToken for interrupt");
				ct.throwIfCancellationRequested();

				helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, avgPrice);

				if (sourceId) {
					const priceSourceIdRedisKey = `${corePriceRedisKey}:${sourceId}`;

					if (this._logger.isTraceEnabled) {
						this._logger.trace("Get price by sourceId");
						this._logger.trace("Execute: HGET", priceSourceIdRedisKey, "price");
					}
					const sourceIdPrice = await this.ioredis.hget(priceSourceIdRedisKey, "price");

					this._logger.trace("Check cancellationToken for interrupt");
					ct.throwIfCancellationRequested();

					helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, sourceId, sourceIdPrice);

				} else if (requiredAllSourceId) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace("Check count sourceId");
						this._logger.trace("Execute: LLEN", priceSourceIdsRedisKey);
					}
					const redisPriceSourceIdCount = await this.ioredis.llen(priceSourceIdsRedisKey);

					this._logger.trace("Check cancellationToken for interrupt");
					ct.throwIfCancellationRequested();

					if (redisPriceSourceIdCount) {
						if (this._logger.isTraceEnabled) {
							this._logger.trace("Get list sourceId");
							this._logger.trace("Execute: LRANGE", priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);
						}
						const sourceIds = await this.ioredis.lrange(priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);

						this._logger.trace("Check cancellationToken for interrupt");
						ct.throwIfCancellationRequested();

						for (let x = 0; x < sourceIds.length; x++) {
							const source = sourceIds[x];
							const sourceIdAvgRedisKey = `${priceSourceIdsRedisKey}${source}`;
							if (this._logger.isTraceEnabled) {
								this._logger.trace("Execute: HGET", sourceIdAvgRedisKey, "price");
							}
							const sourceIdPrice = await this.ioredis.hget(sourceIdAvgRedisKey, "price");

							this._logger.trace("Check cancellationToken for interrupt");
							ct.throwIfCancellationRequested();

							helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, source, sourceIdPrice);
						}
					}
				}
			}
			return friendlyPricesChunk;
		}, cancellationToken);
	}

	protected async onInit(): Promise<void> {
		this._logger.trace("Initing");
		await this.ioredis.connect();
		this._logger.trace("Inited");
	}
	protected async onDispose(): Promise<void> {
		this._logger.trace("Disposing");
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
		if (!(tradeCurrency in friendlyPrices[ts][marketCurrency])) {
			if ((avgPrice)) {
				friendlyPrices[ts][marketCurrency][tradeCurrency] = {
					avg: {
						price: avgPrice
					}
				};
			}
			if (!(avgPrice)) {
				friendlyPrices[ts][marketCurrency][tradeCurrency] = {
					avg: null
				};
			}
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
		}
		return friendlyPrices;
	}
}
