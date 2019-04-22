import { assert } from "chai";
import { CryptoCompare } from "../src/providers/source/CryptoCompare";
import { price } from "../src/PriceService";
import { DUMMY_CANCELLATION_TOKEN } from "ptask.js";

describe("Positive tests Source provider CryptoCompare", function () {
	let cryptoCompare: CryptoCompare;
	beforeEach(function () {
		cryptoCompare = new CryptoCompare();
	});
	afterEach(function () {
		cryptoCompare.dispose();
	});
	it("Call method loadPrices", async function () {
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE": {
				20180101101010: {
					"BTC": ["USDT", "ETH"]
				},
				20180202101010: {
					"BTC": ["USDT", "ETH"]
				},
				20180303101010: {
					"BTC": ["USDT", "ETH"]
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

			const arrayMarketLoad = objTradeLoad[keyTradeLoad];
			const objMarketData = objTradeData[keyTradeData];
			assert.isObject(objMarketData);
			assert.isArray(arrayMarketLoad);

			const keysMarket = Object.keys(objMarketData);
			assert.equal(keysMarket.length, arrayMarketLoad.length);

			for (let n = 0; n < keysMarket.length; n++) {
				const keyMarket = keysMarket[n];
				const priceNum = objMarketData[keyMarket];
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
	afterEach(function () {
		cryptoCompare.dispose();
	});
	it("Call method loadPrices catch NoRecordError", async function () {
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE": {
				20180101101010: {
					"BTC999": ["USDT", "ETH"]
				}
			}
		};
		try {
			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
		} catch (err) {
			assert((<any>err).message.startsWith("NameError: Error, message: Unexpected fsym key/data"));
			return;
		}
		assert.fail("Should never happened");
	});
	it("Call method loadPrices catch NoRecordError", async function () {
		const loadData: price.LoadDataRequest = {
			"CRYPTOCOMPARE2": {
				20180101101010: {
					"BTC": ["USDT", "ETH"]
				}
			}
		};
		try {
			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
		} catch (err) {
			assert((<any>err).message.startsWith("NameError: TypeError, message: Cannot convert undefined or null to object"));
			return;
		}
		assert.fail("Should never happened");
	});
});
