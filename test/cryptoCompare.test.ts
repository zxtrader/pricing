// import { assert } from "chai";
// import { Cryptocompare } from "../src/providers/source/Cryptocompare";
// import { price } from "../src/PriceService";
// import { DUMMY_CANCELLATION_TOKEN } from "@zxteam/task";
// import nock = require("nock");


// describe("CryptoCompare", function () {
// 	const urlToCrypto = "https://min-api.cryptocompare.com/data/";

// 	const optsForLimit = {
// 		limit: {
// 			instance: {
// 				parallel: 5,
// 				perSecond: 15,
// 				perMinute: 300,
// 				perHour: 8000
// 			},
// 			timeout: 1000
// 		},
// 		webClient: {
// 			timeout: 750
// 		}
// 	};

// 	const isOnline = true;

// 	const cryptoAPI = nock("https://min-api.cryptocompare.com/data/pricehistorical", { allowUnmocked: isOnline });

// 	describe("Positive tests Source provider CryptoCompare", function () {
// 		let cryptoCompare: Cryptocompare;
// 		beforeEach(function () {
// 			cryptoCompare = new Cryptocompare(urlToCrypto, optsForLimit);
// 		});
// 		afterEach(async function () {
// 			await cryptoCompare.dispose();
// 		});
// 		it("Call method loadPrices", async function () {
// 			const sourceId = "CRYPTOCOMPARE";
// 			const loadData: price.MultyLoadDataRequest = {
// 				[sourceId]: [{
// 					ts: 20180101101010,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};

// 			const response = {
// 				"BTC": {
// 					"USDT": 13400.89
// 				}
// 			};

// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USDT&ts=1514801410"
// 			const nockRes = cryptoAPI.get("?fsym=BTC&tsyms=USDT&ts=1514801410").reply(200, response);

// 			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);

// 			nockRes.done();
// 			assert.isArray(data);
// 			assert.equal(data[0].ts, loadData[sourceId][0].ts);
// 			assert.equal(data[0].tradeCurrency, loadData[sourceId][0].tradeCurrency);
// 			assert.equal(data[0].marketCurrency, loadData[sourceId][0].marketCurrency);
// 			assert.equal(data[0].price, 13400.89);
// 		});
// 		it("Call method loadPrices don't exsist tradeCurrency and array is empty", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE": [{
// 					ts: 20180101101010,
// 					tradeCurrency: "BTC999",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};
// 			const response = {
// 				"Response": "Error",
// 				"Message": "There is no data for the symbol BTC999 .",
// 				"HasWarning": false,
// 				"Type": 2,
// 				"RateLimit": {},
// 				"Data": {},
// 				"ParamWithError": "fsym"
// 			};
// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC999&tsyms=USDT&ts=1514801410"
// 			const nockRes = cryptoAPI.get("?fsym=BTC999&tsyms=USDT&ts=1514801410").reply(200, response);

// 			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
// 			nockRes.done();

// 			assert.isArray(data);
// 			assert.equal(data.length, 0);
// 		});
// 		it("Call method loadPrices don't exsist marketCurrency and array is empty", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE": [{
// 					ts: 20180101101010,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT9991",
// 					price: null
// 				}]
// 			};
// 			const response = {
// 				"Response": "Error",
// 				"Message": "There is no data for any of the toSymbols USDT9991 .",
// 				"HasWarning": true,
// 				"Type": 2,
// 				"RateLimit": {},
// 				"Data": {},
// 				"Warning": "There is no data for the toSymbol/s USDT9991 ",
// 				"ParamWithError": "tsyms"
// 			};
// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USDT9991&ts=1514801410"
// 			const nockRes = cryptoAPI.get("?fsym=BTC&tsyms=USDT9991&ts=1514801410").reply(200, response);

// 			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
// 			nockRes.done();
// 			assert.isArray(data);
// 			assert.equal(data.length, 0);
// 		});
// 		it("Call method loadPrices timestamp early and array is empty", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE": [{
// 					ts: 20000101101010,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};
// 			const response = {
// 				"BTC": {
// 					"USDT": 0
// 				}
// 			};
// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USDT&ts=946721410"
// 			const nockRes = cryptoAPI.get("?fsym=BTC&tsyms=USDT&ts=946721410").reply(200, response);

// 			const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
// 			nockRes.done();

// 			assert.isArray(data);
// 			assert.equal(data.length, 0);
// 		});
// 	});

// 	describe("Negative tests Source provider CryptoCompare", function () {
// 		let cryptoCompare: Cryptocompare;
// 		beforeEach(function () {

// 			cryptoCompare = new Cryptocompare(urlToCrypto, optsForLimit);
// 		});
// 		afterEach(async function () {
// 			await cryptoCompare.dispose();
// 		});

// 		it("Call method loadPrices ts param is not an integer and array is empty", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE": [{
// 					ts: NaN,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};
// 			const response = {
// 				Data: {},
// 				HasWarning: false,
// 				Message: "ts param is not an integer, not a valid timestamp.",
// 				ParamWithError: "ts",
// 				RateLimit: {},
// 				Response: "Error",
// 				Type: 2
// 			};
// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USDT&ts=NaN"
// 			const nockRes = cryptoAPI.get("?fsym=BTC&tsyms=USDT&ts=NaN").reply(200, response);
// 			try {

// 				const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);

// 			} catch (err) {
// 				nockRes.done();
// 				assert((<any>err).message.startsWith("ts param is not an integer, not a valid timestamp."));
// 				return;
// 			}
// 			assert.fail("Should never happened");

// 		});
// 		it("Imitation big rate limit", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE": [{
// 					ts: 20180101101010,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};
// 			const response = {
// 				"Response": "Error",
// 				"Message": "Limit request.",
// 				"HasWarning": false,
// 				"Type": 2,
// 				"RateLimit": {},
// 				"Data": {
// 					"Message": "Limit request",
// 					"Response": "Error"
// 				},
// 				"ParamWithError": "limit"
// 			};
// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USDT&ts=1514801410"
// 			const nockRes = cryptoAPI.get("?fsym=BTC&tsyms=USDT&ts=1514801410").reply(200, response);
// 			try {
// 				const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
// 			} catch (err) {
// 				nockRes.done();
// 				assert((<any>err).message.startsWith("Limit request"));
// 				return;
// 			}
// 			assert.fail("Should never happened");
// 		});
// 		it("Call method loadPrices catch Error", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE2": [{
// 					ts: 20180101101010,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};
// 			try {
// 				const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
// 			} catch (err) {
// 				assert((<any>err).message.startsWith("Cannot read property 'length' of undefined"));
// 				return;
// 			}
// 			assert.fail("Should never happened");
// 		});
// 		it("Invalid response from cryptocompare", async function () {
// 			const loadData: price.MultyLoadDataRequest = {
// 				"CRYPTOCOMPARE": [{
// 					ts: 20100101010101,
// 					tradeCurrency: "BTC",
// 					marketCurrency: "USDT",
// 					price: null
// 				}]
// 			};
// 			const response = {
// 				12312: {}
// 			};
// 			// "https://min-api.cryptocompare.com/data/pricehistorical?fsym=BTC&tsyms=USDT&ts=20100101010101"
// 			const nockRes = cryptoAPI.get("?fsym=BTC&tsyms=USDT&ts=1262307661").reply(200, response);
// 			try {
// 				const data = await cryptoCompare.loadPrices(DUMMY_CANCELLATION_TOKEN, loadData);
// 			} catch (err) {
// 				nockRes.done();
// 				cryptoAPI.done();
// 				assert((<any>err).message.startsWith("CryptoCompare responded non-expected data type"));
// 				return;
// 			}
// 			assert.fail("Should never happened");
// 		});
// 	});
// });
