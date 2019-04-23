import { assert } from "chai";
import { CryptoCompare } from "../src/providers/source/CryptoCompare";
import { price } from "../src/PriceService";
import { DUMMY_CANCELLATION_TOKEN } from "ptask.js";

describe("Positive tests Source provider CryptoCompare", function () {
	let cryptoCompare: CryptoCompare;
	beforeEach(function () {
		cryptoCompare = new CryptoCompare();
	});
	afterEach(async function () {
		await cryptoCompare.dispose();
	});
	it("Call method loadPrices", async function () {
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE": {
				20180101101010: {
					"BTC": {
						"USDT": null,
						"ETH": null
					},
					"ETH": {
						"USDT": null,
						"BTC": null
					}
				},
				20180202101010: {
					"BTC": {
						"USDT": null,
						"ETH": null
					}
				},
				20180303101010: {
					"BTC": {
						"USDT": null,
						"ETH": null
					}
				}
			}
		};

		const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);

		assert.isObject(data);

		const keySourceLoad = Object.keys(loadData)[0];
		const keySourceData = Object.keys(data)[0];
		assert.equal(keySourceData, keySourceLoad);

		const keysTsLoad = Object.keys(loadData[keySourceLoad]);
		const keysTsData = Object.keys(data[keySourceData]);
		assert.equal(keysTsData.length, keysTsLoad.length);

		for (let i = 0; i < keysTsData.length; i++) {
			const keyTsLoad = Number(keysTsLoad[i]);
			const keyTsData = Number(keysTsData[i]);
			assert.equal(keyTsData, keyTsLoad);

			const objTradeLoad = loadData[keySourceLoad][keyTsLoad];
			const objTradeData = data[keySourceData][keyTsData];
			assert.equal(Object.keys(objTradeData).length, Object.keys(objTradeLoad).length);

			const keyTradeLoad = Object.keys(objTradeLoad)[0];
			const keyTradeData = Object.keys(objTradeData)[0];
			assert.equal(keyTradeData, keyTradeLoad);

			const objMarketLoad = objTradeLoad[keyTradeLoad];
			const objMarketData = objTradeData[keyTradeData];
			assert.isObject(objMarketData);
			assert.isObject(objMarketLoad);

			const keysMarketLoad = Object.keys(objMarketLoad);
			const keysMarketData = Object.keys(objMarketData);
			assert.equal(keysMarketData.length, keysMarketLoad.length);

			for (let n = 0; n < keysMarketData.length; n++) {
				const keyMarket = keysMarketData[n];
				const priceNum = objMarketData[keyMarket];
				assert.isNotNull(priceNum);
				assert.isNumber(priceNum);
			}
		}
	});
	it("Call method loadPrices with unreal timestamp", async function () {
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE": {
				20300202101010: {
					"BTC": {
						"USDT": null,
						"ETH": null
					}
				},
				19720303101010: {
					"BTC": {
						"USDT": null,
						"ETH": null
					}
				}
			}
		};

		const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);

		assert.isObject(data);

		const keySourceLoad = Object.keys(loadData)[0];
		const keySourceData = Object.keys(data)[0];
		assert.equal(keySourceData, keySourceLoad);

		const keysTsLoad = Object.keys(loadData[keySourceLoad]);
		const keysTsData = Object.keys(data[keySourceData]);
		assert.equal(keysTsData.length, keysTsLoad.length);

		for (let i = 0; i < keysTsData.length; i++) {
			const keyTsLoad = Number(keysTsLoad[i]);
			const keyTsData = Number(keysTsData[i]);
			assert.equal(keyTsData, keyTsLoad);

			const objTradeLoad = loadData[keySourceLoad][keyTsLoad];
			const objTradeData = data[keySourceData][keyTsData];
			assert.equal(Object.keys(objTradeData).length, Object.keys(objTradeLoad).length);

			const keyTradeLoad = Object.keys(objTradeLoad)[0];
			const keyTradeData = Object.keys(objTradeData)[0];
			assert.equal(keyTradeData, keyTradeLoad);

			const objMarketLoad = objTradeLoad[keyTradeLoad];
			const objMarketData = objTradeData[keyTradeData];
			assert.isObject(objMarketData);
			assert.isObject(objMarketLoad);

			const keysMarketLoad = Object.keys(objMarketLoad);
			const keysMarketData = Object.keys(objMarketData);
			assert.equal(keysMarketData.length, keysMarketLoad.length);

			for (let n = 0; n < keysMarketData.length; n++) {
				const keyMarket = keysMarketData[n];
				const priceNum = objMarketData[keyMarket];
				assert.isNotNull(priceNum);
				assert.isNumber(priceNum);
			}
		}
	});
});

describe("Negative tests Source provider CryptoCompare", function () {
	let cryptoCompare: CryptoCompare;
	beforeEach(function () {
		cryptoCompare = new CryptoCompare();
	});
	afterEach(async function () {
		await cryptoCompare.dispose();
	});
	it("Call method loadPrices catch Error", async function () {
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE": {
				20180101101010: {
					"BTC999": {
						"USDT": null,
						"ETH": null
					}
				}
			}
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
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE2": {
				20180101101010: {
					"BTC": {
						"USDT": null,
						"ETH": null
					}
				}
			}
		};
		try {
			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
		} catch (err) {
			assert((<any>err).message.startsWith("Cannot convert undefined or null to object"));
			return;
		}
		assert.fail("Should never happened");
	});
});
