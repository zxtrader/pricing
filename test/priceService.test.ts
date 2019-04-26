import { assert } from "chai";
import { price } from "../src/index";
import { loggerFactory } from "@zxteam/logger";
import { DUMMY_CANCELLATION_TOKEN } from "ptask.js";
import { CryptoCompare } from "../src/providers/source/CryptoCompare";
import { RandomSource } from "../src/providers/source/RandomSource";
import { RedisStorageProvider } from "../src/providers/storage/RedisStorageProvider";
import { PriceService } from "../src/index";
import ensureFactory from "@zxteam/ensure.js";
import { RedisOptions } from "ioredis";

let redisStorageProvider: RedisStorageProvider;
let cryptoCompare: CryptoCompare;
let randomSource: RandomSource;
let priceService: PriceService;
const log = loggerFactory.getLogger("ZXTrader's Price Service");

const ensureTestDbUrl = ensureFactory((message, data) => { throw new Error(`Unexpected value of TEST_DB_URL. ${message}`); });

function getOptsForRedis(): RedisOptions {
	function praseToOptsRedis(url: URL): RedisOptions {
		const host = url.hostname;
		const port = Number(url.port);
		const db = Number(url.pathname.slice(1));

		const opts: RedisOptions = {
			port,
			host,
			family: 4,
			password: "",
			db
		};
		return opts;
	}
	function parseDbServerUrl(url: string): URL {
		try {
			return new URL(url);
		} catch (e) {
			throw new Error(`Wrong TEST_DB_URL = ${url}. ${e.message}.`);
		}
	}

	if ("TEST_DB_URL" in process.env) {
		const urlStr = ensureTestDbUrl.string(process.env.TEST_DB_URL as string);

		const url = parseDbServerUrl(urlStr);

		const optsForRedis: RedisOptions = praseToOptsRedis(url);

		return optsForRedis;

	} else {
		throw new Error("TEST_DB_URL environment is not defined. Please set the variable to use these tests.");
	}
}

const optsForLimit = {
	limit: {
		instance: {
			parallel: 5,
			perSecond: 15,
			perMinute: 300,
			perHour: 8000
		},
		timeout: 1000
	},
	webClient: {
		timeout: 750
	}
};

describe("Positive tests Price service", function () {
	beforeEach(function () {
		redisStorageProvider = new RedisStorageProvider(getOptsForRedis(), log);
		cryptoCompare = new CryptoCompare(optsForLimit);
		randomSource = new RandomSource();
		priceService = new PriceService(redisStorageProvider, [cryptoCompare, randomSource], log);
	});
	afterEach(async function () {
		await cryptoCompare.dispose();
		await redisStorageProvider.dispose();
	});
	it("Call method getHistoricalPrices without sources", async function () {
		const args: Array<price.Argument> = [
			{
				ts: 20180101101130,
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false
			}
		];

		const data = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args);

		assert.isObject(data);

		const ts = Number(Object.keys(data)[0]);
		assert.equal(ts, args[0].ts);

		const tsObj = data[ts];

		const marketCurrency = Object.keys(tsObj)[0];
		assert.equal(marketCurrency, args[0].marketCurrency);

		const tradeCurrency = Object.keys(tsObj[marketCurrency])[0];
		assert.equal(tradeCurrency, args[0].tradeCurrency);

		const tradeCurrencyObj = tsObj[marketCurrency][tradeCurrency];
		if (tradeCurrencyObj.avg) {
			assert.isNumber(+tradeCurrencyObj.avg.price);
		} else {
			assert.isNull(tradeCurrencyObj.avg);
		}

		if ("sources" in tradeCurrencyObj) {
			assert.fail();
		}
	});
	it("Call method getHistoricalPrices on PriceService", async function () {
		const args: Array<price.Argument> = [
			{
				ts: 20180101101130,
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false
			}, {
				ts: 20180101101120,
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "CRYPTOCOMPARE"
			}, {
				ts: 20180101101011,
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "CRYPTOCOMPARE"
			}, {
				ts: 20180101101011,
				marketCurrency: "USDT",
				tradeCurrency: "ETH",
				requiredAllSourceIds: false,
				sourceId: "CRYPTOCOMPARE"
			}, {
				ts: 20180101101011,
				marketCurrency: "ETH",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "CRYPTOCOMPARE"
			}, {
				ts: 20180101101021,
				marketCurrency: "ETH",
				tradeCurrency: "BTC",
				requiredAllSourceIds: true
			}, {
				ts: 20180101101022,
				marketCurrency: "ETH",
				tradeCurrency: "BTC",
				requiredAllSourceIds: true
			}, {
				ts: 20180101101011,
				marketCurrency: "XMR",
				tradeCurrency: "BTC",
				requiredAllSourceIds: true
			}, {
				ts: 20180101101011,
				marketCurrency: "XMR",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "RANDOMSOURCE"
			}, {
				ts: 20180101101011,
				marketCurrency: "USDT",
				tradeCurrency: "ETH",
				requiredAllSourceIds: false,
				sourceId: "RANDOMSOURCE"
			}, {
				ts: 20180101101011,
				marketCurrency: "ETH",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "RANDOMSOURCE"
			}, {
				ts: 20180101101120,
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "RANDOMSOURCE"
			}
		];

		const data = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args);

		assert.isObject(data);

	});
});
