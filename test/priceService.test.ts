import { assert } from "chai";
import { RedisOptions } from "ioredis";
import { PriceService, price } from "../src/PriceService";
import { loggerFactory } from "@zxteam/logger";
import { ensureFactory } from "@zxteam/ensure.js";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
import { Randomsource } from "../src/providers/source/Randomsource";
import { Cryptocompare } from "../src/providers/source/Cryptocompare";
import { RedisStorageProvider } from "../src/providers/storage/RedisStorageProvider";

let redisStorageProvider: RedisStorageProvider = new RedisStorageProvider(getOptsForRedis());
let cryptoCompare: Cryptocompare;
let randomSource: Randomsource;
let priceService: PriceService;
const log = loggerFactory.getLogger("ZXTrader's Price Service");

// const ensureTestDbUrl = ensureFactory((message, data) => { throw new Error(`Unexpected value of DATASTORAGE_URL. ${message}`); });

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
			throw new Error(`Wrong DATASTORAGE_URL = ${url}. ${e.message}.`);
		}
	}

	if ("DATASTORAGE_URL" in process.env) {
		const urlStr = String(process.env.DATASTORAGE_URL);

		const url = parseDbServerUrl(urlStr);

		const optsForRedis: RedisOptions = praseToOptsRedis(url);

		return optsForRedis;

	} else {
		throw new Error(`DATASTORAGE_URL environment is not defined. Please set the variable to use these tests ${process.env.DATASTORAGE_URL}`);
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

const urlToCrypto = "https://min-api.cryptocompare.com/data/";

describe("Positive tests Price service", function () {
	before(async function () {
		await redisStorageProvider.init();
		cryptoCompare = new Cryptocompare(urlToCrypto, optsForLimit);
		randomSource = new Randomsource();
		priceService = new PriceService(redisStorageProvider, [cryptoCompare, randomSource]);
	});
	after(async function () {
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
	it("Call method getHistoricalPrices with fake source", async function () {
		const args: Array<price.Argument> = [
			{
				ts: 20180101101130,
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				requiredAllSourceIds: false,
				sourceId: "FAKE_SOURCE"
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

		// if ("sources" in tradeCurrencyObj && tradeCurrencyObj.sources !== undefined) {
		// 	const sourceObj = tradeCurrencyObj.sources;
		// 	const countKeys = Object.keys(sourceObj).length;
		// 	assert(!countKeys);
		// } else {
		// 	assert.fail();
		// }
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
