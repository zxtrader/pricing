import { assert } from "chai";
import { RedisOptions } from "ioredis";
import { PriceService } from "../src/api/PriceService";
import { PriceServiceImpl } from "../src/api/PriceServiceImpl";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/cancellation";
import { Randomizer } from "../src/priceLoader/Randomizer";
import { Cryptocompare } from "../src/priceLoader/Cryptocompare";
import { RedisStorage } from "../src/storage/RedisStorage";



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
	let redisStorageProvider: RedisStorage;
	let cryptoCompare: Cryptocompare;
	let randomSource: Randomizer;
	let priceService: PriceService;

	before(async function () {

		cryptoCompare = new Cryptocompare(optsForLimit);
		randomSource = new Randomizer();
		priceService = new PriceServiceImpl(() => new RedisStorage(getRedisURL()), [cryptoCompare, randomSource]);
	});
	after(async function () {
		await cryptoCompare.dispose();
		await redisStorageProvider.dispose();
	});
	it("Call method getHistoricalPrices without sources", async function () {
		const args: Array<PriceService.Argument> = [
			{
				ts: 20180101101130,
				marketCurrency: "UDSDT",
				tradeCurrency: "DBTC",
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
		const args: Array<PriceService.Argument> = [
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
		const args: Array<PriceService.Argument> = [
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
