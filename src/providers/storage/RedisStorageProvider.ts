import { Task } from "@zxteam/task";
import { price } from "../../PriceService";
import * as RedisClient from "ioredis";
import loggerFactory from "@zxteam/logger";
import * as zxteam from "@zxteam/contract";
import { Redis, RedisOptions } from "ioredis";
import { Initable } from "@zxteam/disposable";
import { StorageProvider as StorageProviderInerface } from "./contract";
import { financial } from "../../financial.js";

export class RedisStorageProvider extends Initable implements StorageProviderInerface {
	private readonly _prefix: string;
	private readonly ioredis: Redis;
	private readonly _logger = loggerFactory.getLogger("RedisStorage");
	constructor(dataStorageUrl: URL) {
		super();
		const opts: RedisOptions = RedisStorageProvider.parseRedisURL(dataStorageUrl);
		this.ioredis = new RedisClient(opts);
		this._prefix = opts.keyPrefix !== undefined ? opts.keyPrefix : "";
	}

	public async filterEmptyPrices(cancellationToken: zxteam.CancellationToken, args: Array<price.Argument>, sources: Array<string>)
		: Promise<Array<price.LoadDataRequest>> {
		this._logger.trace("filterEmptyPrices()... ");
		const friendlyRequest: Array<price.LoadDataRequest> = [];
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds: requiredAllSourceSystems } = arg;

			this._logger.trace("Create keys for search price");
			const corePriceRedisKey = `${this._prefix}${ts}:${marketCurrency}:${tradeCurrency}`;

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
				cancellationToken.throwIfCancellationRequested();

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
					cancellationToken.throwIfCancellationRequested();

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
	}

	public async savePrices(cancellationToken: zxteam.CancellationToken, newPrices: Array<price.HistoricalPrices>): Promise<void> {
		this._logger.trace("savePrices()...");
		for (let n = 0; n < newPrices.length; n++) {
			const argNewPrice = newPrices[n];

			const { sourceId, ts, marketCurrency, tradeCurrency, price: newPrice } = argNewPrice;

			this._logger.trace("Create keys for save price");
			const corePriceRedisKey = `${this._prefix}${ts}:${marketCurrency}:${tradeCurrency}`;
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

			// const avgPrice = (totalSum + +newPrice) / (redisPriceSourceIdCount + 1);
			const financialNewPrice = financial.wrap(newPrice);
			const financialTotalSum = financial.wrap(totalSum.toFixed(8));
			const financialredisPriceSourceIdCount = financial.wrap(redisPriceSourceIdCount.toFixed(0));

			const financialSum = financial.add(financialTotalSum, financialNewPrice);
			const financialCount = financial.add(financialredisPriceSourceIdCount, financial.fromInt(1));

			const financialAvgPrice = financial.divide(financialSum, financialCount);

			if (this._logger.isTraceEnabled) {
				this._logger.trace("Save new avg price");
				this._logger.trace("Execute: HSET", corePriceRedisKey, "price", financial.toString(financialAvgPrice));
			}
			await this.ioredis.hset(corePriceRedisKey, "price", financial.toString(financialAvgPrice));

			// We can't use cancellationToken, need calculating avg price and save in base.

			if (this._logger.isTraceEnabled) {
				this._logger.trace("Save sourceId as key");
				this._logger.trace("Execute: LPUSH", priceSourceIdsRedisKey, sourceId);
			}
			await this.ioredis.lpush(priceSourceIdsRedisKey, sourceId);
		}
	}

	public async findPrices(cancellationToken: zxteam.CancellationToken, args: Array<price.Argument>): Promise<price.Timestamp> {
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
			const corePriceRedisKey = `${this._prefix}${ts}:${marketCurrency}:${tradeCurrency}`;
			const priceSourceIdsRedisKey = `${corePriceRedisKey}:`;

			if (this._logger.isTraceEnabled) {
				this._logger.trace("Save price by sourceId");
				this._logger.trace("Execute: HGET", corePriceRedisKey, "price");
			}
			const avgPrice = await this.ioredis.hget(corePriceRedisKey, "price");

			this._logger.trace("Check cancellationToken for interrupt");
			cancellationToken.throwIfCancellationRequested();

			helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, avgPrice);

			if (sourceId) {
				const priceSourceIdRedisKey = `${corePriceRedisKey}:${sourceId}`;

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Get price by sourceId");
					this._logger.trace("Execute: HGET", priceSourceIdRedisKey, "price");
				}
				const sourceIdPrice = await this.ioredis.hget(priceSourceIdRedisKey, "price");

				this._logger.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();

				helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, sourceId, sourceIdPrice);

			} else if (requiredAllSourceId) {
				if (this._logger.isTraceEnabled) {
					this._logger.trace("Check count sourceId");
					this._logger.trace("Execute: LLEN", priceSourceIdsRedisKey);
				}
				const redisPriceSourceIdCount = await this.ioredis.llen(priceSourceIdsRedisKey);

				this._logger.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();

				if (redisPriceSourceIdCount) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace("Get list sourceId");
						this._logger.trace("Execute: LRANGE", priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);
					}
					const sourceIds = await this.ioredis.lrange(priceSourceIdsRedisKey, 0, redisPriceSourceIdCount);

					this._logger.trace("Check cancellationToken for interrupt");
					cancellationToken.throwIfCancellationRequested();

					for (let x = 0; x < sourceIds.length; x++) {
						const source = sourceIds[x];
						const sourceIdAvgRedisKey = `${priceSourceIdsRedisKey}${source}`;
						if (this._logger.isTraceEnabled) {
							this._logger.trace("Execute: HGET", sourceIdAvgRedisKey, "price");
						}
						const sourceIdPrice = await this.ioredis.hget(sourceIdAvgRedisKey, "price");

						this._logger.trace("Check cancellationToken for interrupt");
						cancellationToken.throwIfCancellationRequested();

						helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, source, sourceIdPrice);
					}
				}
			}
		}
		return friendlyPricesChunk;
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

	private static parseRedisURL(dataStorageUrl: URL): RedisOptions {
		const host = dataStorageUrl.hostname;
		const port = Number(dataStorageUrl.port);
		const db = Number(dataStorageUrl.pathname.slice(1));
		const family: 4 | 6 = dataStorageUrl.searchParams.has("ip_family") && dataStorageUrl.searchParams.get("ip_family") === "6" ? 6 : 4;
		const opts: RedisOptions = {
			host, port, db, family,
			lazyConnect: true
		};

		if (dataStorageUrl.searchParams.has("name")) {
			opts.connectionName = dataStorageUrl.searchParams.get("name") as string;
		}
		if (dataStorageUrl.searchParams.has("prefix")) {
			opts.keyPrefix = dataStorageUrl.searchParams.get("prefix") as string;
		}
		if (dataStorageUrl.searchParams.has("keepAlive")) {
			const keepAliveStr = dataStorageUrl.searchParams.get("keepAlive") as string;
			const keepAlive = Number.parseInt(keepAliveStr);
			if (!Number.isSafeInteger(keepAlive) || keepAlive <= 0) {
				throw new Error(`Wrong keepAlive value: ${keepAliveStr}. Expected positive integer.`);
			}
			opts.keepAlive = keepAlive;
		}

		return opts;
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
