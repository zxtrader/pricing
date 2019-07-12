import { assert } from "chai";
import { RedisOptions } from "ioredis";
import { PriceService, price } from "../src/PriceService";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
import { Randomsource } from "../src/providers/source/Randomsource";
import { Cryptocompare } from "../src/providers/source/Cryptocompare";
import { Poloniex } from "../src/providers/source/Poloniex";
import { RedisStorageProvider } from "../src/providers/storage/RedisStorageProvider";



function getRedisURL(): URL {
	if (process.env.dataStorageURL !== undefined) {
		return new URL(process.env.dataStorageURL);
	} else {
		throw new Error(`dataStorageURL environment is not defined. Please set the variable to use these tests ${process.env.dataStorageURL}`);
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

// const urlToCrypto = "https://min-api.cryptocompare.com/data/";
// const urlToPoloniex = "https://poloniex.com/";

describe("Positive tests Price service", function () {
	let redisStorageProvider: RedisStorageProvider;
	let cryptoCompare: Cryptocompare;
	let poloniex: Poloniex;
	let randomSource: Randomsource;
	let priceService: PriceService;

	before(async function () {
		redisStorageProvider = new RedisStorageProvider(getRedisURL());
		await redisStorageProvider.init();
		cryptoCompare = new Cryptocompare(optsForLimit);
		poloniex = new Poloniex(optsForLimit);
		randomSource = new Randomsource();
		priceService = new PriceService(redisStorageProvider, [cryptoCompare, randomSource, poloniex]);
	});
	after(async function () {
		await cryptoCompare.dispose();
		await poloniex.dispose();
		await redisStorageProvider.dispose();
	});
	it("Call method getHistoricalPrices without sources", async function () {
		const args: Array<price.Argument> = [
			{
				ts: 20180101101130,
				marketCurrency: "UDSDT",
				tradeCurrency: "DBTC",
				requiredAllSourceIds: false
			}
		];

		const data = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;

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

		const data = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;

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

		const data = await priceService.getHistoricalPrices(DUMMY_CANCELLATION_TOKEN, args).promise;

		assert.isObject(data);

	});
});
