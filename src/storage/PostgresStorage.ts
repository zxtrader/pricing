import { CancellationToken, Financial } from "@zxteam/contract";
import { Initable } from "@zxteam/disposable";
import loggerFactory from "@zxteam/logger";

import { PriceApi } from "../api/PriceApi";
import { Storage } from "./Storage";
import { PostgresProviderFactory } from "@zxteam/sql-postgres";
import { PostresqlConnection } from "../provider/ConfigurationProvider";
import { SqlProvider, SqlResultRecord } from "@zxteam/sql";
import moment = require("moment");
import { Helpers } from "../utils/Helpers";

export class PostgresStogare extends Initable implements Storage {
	private readonly _postgresProviderFactory: PostgresProviderFactory;
	private readonly _sourcesPriorityQueue: ReadonlyArray<string>;
	private readonly _logger = loggerFactory.getLogger("PostgresStogare");

	constructor(
		postgresUrl: PostresqlConnection,
		sourcesPriorityQueue: ReadonlyArray<string>
	) {
		super();
		this._sourcesPriorityQueue = sourcesPriorityQueue;
		const opts: PostgresProviderFactory.Opts = Object.freeze({
			url: postgresUrl.url
		});
		if (this._logger.isTraceEnabled) {
			this._logger.trace(`Postges use connection url: ${Helpers.MaskUriPasswords(postgresUrl.url.toString())}`);
		}
		this._postgresProviderFactory = new PostgresProviderFactory(opts);
	}

	public async filterEmptyPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>, sources: Array<string>)
		: Promise<Array<PriceApi.LoadDataRequest>> {
		if (this._logger.isTraceEnabled) {
			this._logger.trace("filterEmptyPrices()... ");
		}
		const friendlyRequest: Array<PriceApi.LoadDataRequest> = [];

		await this._postgresProviderFactory.usingProviderWithTransaction(cancellationToken, async (sqlProvider: SqlProvider) => {
			this.verifyNotDisposed();

			for (const arg of args) {
				const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds: requiredAllSourceSystems } = arg;

				if (sourceId) {
					sources = [sourceId];
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Searach price for source: ${sourceId}`);
					}
				} else {
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Searach price for all source: ${sources}`);
					}
				}

				const momentTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss");

				if (this._logger.isTraceEnabled) {
					this._logger.trace(`Selecting prices ${marketCurrency}:${tradeCurrency}, ${momentTimeStamp.toString()}`);
				}

				const sqlRows: ReadonlyArray<SqlResultRecord> = await sqlProvider.statement(
					'SELECT "source" FROM "cp2_pricing"."historical_rate" '
					+ 'WHERE "quote_currency" = $1 AND "base_currency" = $2 AND "source" = ANY($3) '
					+ 'AND "utc_created_at" = to_timestamp($4::DOUBLE PRECISION)::TIMESTAMP WITHOUT TIME ZONE'
				).executeQuery(cancellationToken, marketCurrency, tradeCurrency, sources, momentTimeStamp.unix().toString());

				if (this._logger.isTraceEnabled) {
					this._logger.trace("Check cancellationToken for interrupt");
				}
				cancellationToken.throwIfCancellationRequested();

				const priceSources = sqlRows.map((e: SqlResultRecord) => e.get("source").asString);
				const emptyPriceSources = sources.filter((e: string) => !priceSources.includes(e));
				
				if (this._logger.isTraceEnabled) {
					this._logger.trace("Formatting data and push to friendly array");
				}
				for (const emptyPriceSource of emptyPriceSources) {
					const sourceNameId = emptyPriceSource;
					friendlyRequest.push({
						sourceId: sourceNameId,
						ts,
						marketCurrency,
						tradeCurrency
					});
				}

			}
		});
		return friendlyRequest;
	}

	public async savePrices(cancellationToken: CancellationToken, newPrices: Array<PriceApi.HistoricalPrices>): Promise<void> {
		this._logger.trace("savePrices()...");
		await this._postgresProviderFactory.usingProviderWithTransaction(cancellationToken, async (sqlProvider: SqlProvider) => {
			for (let newPrice of newPrices) {
				const { sourceId, ts, marketCurrency, tradeCurrency, price } = newPrice;
				const momentTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss");

				if (this._logger.isTraceEnabled) {
					this._logger.trace(`Save price ${marketCurrency}:${tradeCurrency}, ${sourceId}, ${price}, ${momentTimeStamp.toString()}`);
				}

				await sqlProvider.statement(
					'INSERT INTO "cp2_pricing"."historical_rate" ("quote_currency", "base_currency", "source", "rate", "utc_created_at") '
					+ 'VALUES ($1, $2, $3, $4, to_timestamp($5::DOUBLE PRECISION)::TIMESTAMP WITHOUT TIME ZONE)'
				).execute(cancellationToken, marketCurrency, tradeCurrency, sourceId, price, momentTimeStamp.unix().toString());
				cancellationToken.throwIfCancellationRequested();
			}
		});
	}

	public async findPrices(cancellationToken: CancellationToken, args: Array<PriceApi.Argument>): Promise<PriceApi.Timestamp> {
		this._logger.trace("Begin find price in redis database");
		const friendlyPricesChunk: PriceApi.Timestamp = {};

		if (this._logger.isTraceEnabled) {
			this._logger.trace("Foreach args: ", args);
		}

		for (const arg of args) {
			if (this._logger.isTraceEnabled) {
				this._logger.trace("List atr in arg: ", arg);
			}
			const { ts, marketCurrency, tradeCurrency, sourceId, requiredAllSourceIds } = arg;
			const momentTimeStamp = moment.utc(ts, "YYYYMMDDHHmmss");

			if (sourceId) {
				await this._postgresProviderFactory.usingProviderWithTransaction(cancellationToken, async (sqlProvider: SqlProvider) => {
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Get price by sourceId ${sourceId}, ${marketCurrency}, ${tradeCurrency}, ${momentTimeStamp.toString()}`);
					}

					const sqlRow: SqlResultRecord | null = await sqlProvider.statement(
						'SELECT "rate" FROM "cp2_pricing"."historical_rate" '
						+ 'WHERE "quote_currency" = $1 AND "base_currency" = $2 AND "source" = $3 '
						+ 'AND "utc_created_at" = to_timestamp($4::DOUBLE PRECISION)::TIMESTAMP WITHOUT TIME ZONE'
					).executeSingleOrNull(cancellationToken, marketCurrency, tradeCurrency, sourceId, momentTimeStamp.unix().toString());

					cancellationToken.throwIfCancellationRequested();
					if (sqlRow === null) {
						this._logger.error(`Can not get price by sourceId ${sourceId}, ${marketCurrency}, ${tradeCurrency}, ${ts}`);

					} else {
						Helpers.AddPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, sourceId, sqlRow.get("rate").asString);
					}
				});
			} else {
				await this._postgresProviderFactory.usingProviderWithTransaction(cancellationToken, async (sqlProvider: SqlProvider) => {
					if (this._logger.isTraceEnabled) {
						this._logger.trace(`Get all prices ${marketCurrency}, ${tradeCurrency}, ${momentTimeStamp.toString()}`);
					}

					const sqlRows: ReadonlyArray<SqlResultRecord> = await sqlProvider.statement(
						'SELECT "rate", "source" FROM "cp2_pricing"."historical_rate" '
						+ 'WHERE "quote_currency" = $1 AND "base_currency" = $2 '
						+ 'AND "utc_created_at" = to_timestamp($3::DOUBLE PRECISION)::TIMESTAMP WITHOUT TIME ZONE'
					).executeQuery(cancellationToken, marketCurrency, tradeCurrency, momentTimeStamp.unix().toString());
					cancellationToken.throwIfCancellationRequested();

					for (const sqlRow of sqlRows) {
						Helpers.AddPriceTimeStamp(friendlyPricesChunk, ts, marketCurrency, tradeCurrency, null, sqlRow.get("source").asString, sqlRow.get("rate").asString);
					}
				});
			}
		}
		Helpers.SetPrimaryPrice(friendlyPricesChunk, this._sourcesPriorityQueue);
		return friendlyPricesChunk;
	}

	protected async onInit(cancellationToken: CancellationToken): Promise<void> {
		this._logger.trace("Initing");
		await this._postgresProviderFactory.init(cancellationToken);
		this._logger.trace("Inited");
	}

	protected async onDispose(): Promise<void> {
		this._logger.trace("Disposing");
		await this._postgresProviderFactory.dispose();
		this._logger.trace("Disposed");
	}
}

