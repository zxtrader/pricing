import { assert } from "chai";
import { CryptoCompare } from "../src/providers/source/CryptoCompare";
import { price } from "../src/index";
import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
import loggerFactory from "@zxteam/logger";

const log = loggerFactory.getLogger("ZXTrader's Price Service");

describe("Positive tests Source provider CryptoCompare", function () {
	let cryptoCompare: CryptoCompare;
	beforeEach(function () {
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
		cryptoCompare = new CryptoCompare(optsForLimit, log);
	});
	afterEach(async function () {
		await cryptoCompare.dispose();
	});
	// it("Call method loadPrices", async function () {
	// 	const loadData: Array<price.LoadDataRequest> = [{
	// 		sourceId: "CRYPTOCOMPARE",
	// 		ts: 20180101101010,
	// 		tradeCurrency: "BTC",
	// 		marketCurrency: "USDT",
	// 		price: null
	// 	}, {
	// 		sourceId: "CRYPTOCOMPARE",
	// 		ts: 20180101101010,
	// 		tradeCurrency: "ETH",
	// 		marketCurrency: "USDT",
	// 		price: null
	// 	}, {
	// 		sourceId: "CRYPTOCOMPARE",
	// 		ts: 20180202101010,
	// 		tradeCurrency: "BTC",
	// 		marketCurrency: "USDT",
	// 		price: null
	// 	}, {
	// 		sourceId: "CRYPTOCOMPARE",
	// 		ts: 20180303101010,
	// 		tradeCurrency: "BTC",
	// 		marketCurrency: "USDT",
	// 		price: null
	// 	}];

	// 	const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);

	// 	assert.isObject(data);

	// 	const keySourceLoad = Object.keys(loadData)[0];
	// 	const keySourceData = Object.keys(data)[0];
	// 	assert.equal(keySourceData, keySourceLoad);

	// 	const keysTsLoad = Object.keys(loadData[keySourceLoad]);
	// 	const keysTsData = Object.keys(data[keySourceData]);
	// 	assert.equal(keysTsData.length, keysTsLoad.length);

	// 	for (let i = 0; i < keysTsData.length; i++) {
	// 		const keyTsLoad = Number(keysTsLoad[i]);
	// 		const keyTsData = Number(keysTsData[i]);
	// 		assert.equal(keyTsData, keyTsLoad);

	// 		const objTradeLoad = loadData[keySourceLoad][keyTsLoad];
	// 		const objTradeData = data[keySourceData][keyTsData];
	// 		assert.equal(Object.keys(objTradeData).length, Object.keys(objTradeLoad).length);

	// 		const keyTradeLoad = Object.keys(objTradeLoad)[0];
	// 		const keyTradeData = Object.keys(objTradeData)[0];
	// 		assert.equal(keyTradeData, keyTradeLoad);

	// 		const objMarketLoad = objTradeLoad[keyTradeLoad];
	// 		const objMarketData = objTradeData[keyTradeData];
	// 		assert.isObject(objMarketData);
	// 		assert.isObject(objMarketLoad);

	// 		const keysMarketLoad = Object.keys(objMarketLoad);
	// 		const keysMarketData = Object.keys(objMarketData);
	// 		assert.equal(keysMarketData.length, keysMarketLoad.length);

	// 		for (let n = 0; n < keysMarketData.length; n++) {
	// 			const keyMarket = keysMarketData[n];
	// 			const priceNum = objMarketData[keyMarket];
	// 			assert.isNotNull(priceNum);
	// 			assert.isNumber(priceNum);
	// 		}
	// 	}
	// });
	// it("Call method loadPrices with unreal timestamp", async function () {
	// 	const loadData: price.LoadDataRequest = {
	// 		"CRYPTOCOMPARE": {
	// 			20300202101010: {
	// 				"BTC": {
	// 					"USDT": null,
	// 					"ETH": null
	// 				}
	// 			},
	// 			19720303101010: {
	// 				"BTC": {
	// 					"USDT": null,
	// 					"ETH": null
	// 				}
	// 			}
	// 		}
	// 	};

	// 	const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);

	// 	assert.isObject(data);

	// 	const keySourceLoad = Object.keys(loadData)[0];
	// 	const keySourceData = Object.keys(data)[0];
	// 	assert.equal(keySourceData, keySourceLoad);

	// 	const keysTsLoad = Object.keys(loadData[keySourceLoad]);
	// 	const keysTsData = Object.keys(data[keySourceData]);
	// 	assert.equal(keysTsData.length, keysTsLoad.length);

	// 	for (let i = 0; i < keysTsData.length; i++) {
	// 		const keyTsLoad = Number(keysTsLoad[i]);
	// 		const keyTsData = Number(keysTsData[i]);
	// 		assert.equal(keyTsData, keyTsLoad);

	// 		const objTradeLoad = loadData[keySourceLoad][keyTsLoad];
	// 		const objTradeData = data[keySourceData][keyTsData];
	// 		assert.equal(Object.keys(objTradeData).length, Object.keys(objTradeLoad).length);

	// 		const keyTradeLoad = Object.keys(objTradeLoad)[0];
	// 		const keyTradeData = Object.keys(objTradeData)[0];
	// 		assert.equal(keyTradeData, keyTradeLoad);

	// 		const objMarketLoad = objTradeLoad[keyTradeLoad];
	// 		const objMarketData = objTradeData[keyTradeData];
	// 		assert.isObject(objMarketData);
	// 		assert.isObject(objMarketLoad);

	// 		const keysMarketLoad = Object.keys(objMarketLoad);
	// 		const keysMarketData = Object.keys(objMarketData);
	// 		assert.equal(keysMarketData.length, keysMarketLoad.length);

	// 		for (let n = 0; n < keysMarketData.length; n++) {
	// 			const keyMarket = keysMarketData[n];
	// 			const priceNum = objMarketData[keyMarket];
	// 			assert.isNotNull(priceNum);
	// 			assert.isNumber(priceNum);
	// 		}
	// 	}
	// });
});

describe("Negative tests Source provider CryptoCompare", function () {
	let cryptoCompare: CryptoCompare;
	beforeEach(function () {
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
		cryptoCompare = new CryptoCompare(optsForLimit, log);
	});
	afterEach(async function () {
		await cryptoCompare.dispose();
	});
	it("Call method loadPrices catch Error trade", async function () {
		const loadData: price.MultyLoadDataRequest = {
			"CRYPTOCOMPARE": [{
				ts: 20180101101010,
				tradeCurrency: "BTC999",
				marketCurrency: "USDT",
				price: null
			}]
		};
		try {
			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
		} catch (err) {
			assert((<any>err).message.startsWith("CryptoCompare responded non-expected data type"));
			return;
		}
		assert.fail("Should never happened");
	});
	it("Call method loadPrices catch Error", async function () {
		const loadData: price.MultyLoadDataRequest = {
			"CRYPTOCOMPARE2": [{
				ts: 20180101101010,
				tradeCurrency: "BTC",
				marketCurrency: "USDT",
				price: null
			}]
		};
		try {
			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
		} catch (err) {
			assert((<any>err).message.startsWith("Cannot read property 'length' of undefined"));
			return;
		}
		assert.fail("Should never happened");
	});
});
