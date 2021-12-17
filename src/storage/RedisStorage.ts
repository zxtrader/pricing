import { CancellationToken, Financial } from "@zxteam/contract";
import { Initable } from "@zxteam/disposable";
import loggerFactory from "@zxteam/logger";

import { PriceApi } from "../api/PriceApi";
import * as RedisClient from "ioredis";
import { Redis, RedisOptions } from "ioredis";
import { Storage } from "./Storage";

export class RedisStorage extends Initable implements Storage {
	private readonly ioredis: Redis;
	private readonly _logger = loggerFactory.getLogger("RedisStorage");
	private readonly _sourcesQueue: ReadonlyArray<string>;
	constructor(
		dataStorageUrl: URL,
		sourcesQueue: ReadonlyArray<string>
	) {
		super();
		this._sourcesQueue = sourcesQueue;
		const opts: RedisOptions = RedisStorage.parseRedisURL(dataStorageUrl);
		this.ioredis = new RedisClient(opts);
	}

	public async filterEmptyPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>, sources: Array<string>)
		: Promise<Array<PriceApi.LoadDataRequest>> {
		this._logger.trace("filterEmptyPrices()... ");
		const friendlyRequest: Array<PriceApi.LoadDataRequest> = [];
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds: requiredAllSourceSystems } = arg;

			this._logger.trace("Create keys for search price");
			const corePriceRedisKey = `${ts}:${marketCurrency}:${tradeCurrency}`;

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

	public async savePrices(cancellationToken: CancellationToken, newPrices: Array<PriceApi.HistoricalPrices>): Promise<void> {
		this._logger.trace("savePrices()...");
		for (let n = 0; n < newPrices.length; n++) {
			const argNewPrice = newPrices[n];

			const { sourceId, ts, marketCurrency, tradeCurrency, price: newPrice } = argNewPrice;

			this._logger.trace("Create keys for save price");
			const corePriceRedisKey = `${ts}:${marketCurrency}:${tradeCurrency}`;
			const priceSourceIdsRedisKey = `${corePriceRedisKey}:`;
			const sourceIdPriceRedisKey = `${priceSourceIdsRedisKey}${sourceId}`;

			if (this._logger.isTraceEnabled) {
				this._logger.trace("Save price by sourceId");
				this._logger.trace("Execute: HSET", sourceIdPriceRedisKey, "price", newPrice);
			}
			await this.ioredis.hset(sourceIdPriceRedisKey, "price", newPrice);
			cancellationToken.throwIfCancellationRequested();
		}
	}

	public async findPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>): Promise<PriceApi.Timestamp> {
		this._logger.trace("Begin find price in redis database");

		const friendlyPricesChunk: PriceApi.Timestamp = {};

		if (this._logger.isTraceEnabled) {
			this._logger.trace("Foreach args: ", args);
		}
		for (let i = 0; i < args.length; i++) {
			const arg = args[i];
			if (this._logger.isTraceEnabled) {
				this._logger.trace("List atr in arg: ", arg);
			}

			const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds: requiredAllSourceId } = arg;
			const corePriceRedisKey = `${ts}:${marketCurrency}:${tradeCurrency}`;
			const priceSourceIdsRedisKey = `${corePriceRedisKey}:`;

			// if (this._logger.isTraceEnabled) {
			// 	this._logger.trace("Save price by sourceId");
			// 	this._logger.trace("Execute: HGET", corePriceRedisKey, "price");
			// }
			// const avgPrice = await this.ioredis.hget(corePriceRedisKey, "price");

			// this._logger.trace("Check cancellationToken for interrupt");
			// cancellationToken.throwIfCancellationRequested();

			// helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, avgPrice);

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

			} else {
				if (this._logger.isTraceEnabled) {
					this._logger.trace("Check count sourceId");
					this._logger.trace("Execute: LLEN", priceSourceIdsRedisKey);
				}
				const redisPriceSourceIdCount = await this.ioredis.llen(priceSourceIdsRedisKey);
				const redisPriceSourceIdKeys = await this.ioredis.keys(`*${priceSourceIdsRedisKey}*`);

				this._logger.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();

				if (redisPriceSourceIdKeys.length > 0) {
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Get list sourceId keys ${redisPriceSourceIdKeys}`);
					}
				}

				this._logger.trace("Check cancellationToken for interrupt");
				cancellationToken.throwIfCancellationRequested();

				for (const redisPriceSourceIdKey of redisPriceSourceIdKeys) {
					const keyParts = redisPriceSourceIdKey.split(":");
					keyParts.shift();
					const fiendlyKey = keyParts.join(":");
					const sourceIdPrice = await this.ioredis.hget(fiendlyKey, "price");

					this._logger.trace("Check cancellationToken for interrupt");
					cancellationToken.throwIfCancellationRequested();

					helpers.addPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, keyParts[keyParts.length - 1], sourceIdPrice);
				}

			}
		}
		helpers.setPrimaryPrice(friendlyPricesChunk, this._sourcesQueue)
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
		friendlyPrices: PriceApi.Timestamp,
		ts: number,
		marketCurrency: string,
		tradeCurrency: string,
		avgPrice?: string | null,
		sourceId?: string,
		sourcePrice?: string | null
	): PriceApi.Timestamp {
		if (!(ts in friendlyPrices)) {
			friendlyPrices[ts] = {};
		}
		if (!(marketCurrency in friendlyPrices[ts])) {
			friendlyPrices[ts][marketCurrency] = {};
		}
		if (!(tradeCurrency in friendlyPrices[ts][marketCurrency])) {
			friendlyPrices[ts][marketCurrency][tradeCurrency] = {
				avg: null
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
		}
		return friendlyPrices;
	}

	export function setPrimaryPrice(
		friendlyPrices: PriceApi.Timestamp,
		sourcesQueue: ReadonlyArray<string>
	) {
		for (const ts in friendlyPrices) {
			for (const marketCurrency in friendlyPrices[ts]) {
				for (const tradeCurrency in friendlyPrices[ts][marketCurrency]) {
					const sources = friendlyPrices[ts][marketCurrency][tradeCurrency].sources;
					if (!sources || Object.keys(sources).length === 0) {
						throw new Error("Empty sources. Can not set primary price.");
					}
					friendlyPrices[ts][marketCurrency][tradeCurrency].avg = {
						price: sources[Object.keys(sources)[0]].price,
					};
					const sourceIds = Object.keys(sources);
					for (const source of sourcesQueue) {
						if (sourceIds.includes(source)) {
							friendlyPrices[ts][marketCurrency][tradeCurrency].avg = {
								price: sources[source].price,
							};
							break;
						}
					}
				}
			}
		}
	}
}
