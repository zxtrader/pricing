import * as zxteam from "@zxteam/contract";
import { DUMMY_CANCELLATION_TOKEN, Task } from "@zxteam/task";
import WebClient, { WebClientLike, WebClientInvokeArgs, WebClientInvokeResult } from "@zxteam/webclient";
import RestClient from "@zxteam/restclient";
import { URL } from "url";

import { assert } from "chai";
// import { price } from "../src/PriceService";
// import nock = require("nock");

import { SourceProvider } from "../src/providers/source/contract";
import { Cryptocompare } from "../src/providers/source/Cryptocompare";
import { price } from "../src/PriceService";



describe("Crypto Compare Tests", function () {
	const cryptocompareUrl = new URL("https://min-api.cryptocompare.com/data/");

	it.only("Should raise SourceProvider.CommunicationError if WebClient providers WebClient.CommunicationError", async function () {
		// Fake arguments to force NoDataError
		const loadArgs: Array<price.LoadDataArgs> = [
			{
				ts: 20190101000000,
				marketCurrency: "BADCOIN",
				tradeCurrency: "XYI9CECOIN"
			}
		];

		let workToken;
		let workArgs: any;
		let workCount = 0;
		const fakeWebClient: WebClientLike = {
			dispose(): zxteam.Task<void> { return Task.resolve(); },
			invoke(cancellationToken: zxteam.CancellationToken, args: WebClientInvokeArgs): zxteam.Task<WebClientInvokeResult> {
				workArgs = args;
				workToken = cancellationToken;
				workCount++;
				return Task.reject(new WebClient.CommunicationError("Test fake error. Emulate no connection"));
			}
		};

		// Options for Cryptocompare Provider
		const opts: RestClient.Opts = {
			webClient: fakeWebClient
		};

		// Create an instance of Cryptocompare Provider
		const sourceProvider = new Cryptocompare(cryptocompareUrl, opts);

		let expectedError: SourceProvider.CommunicationError | undefined;
		try {
			await sourceProvider.loadPrices(DUMMY_CANCELLATION_TOKEN, loadArgs).promise;
		} catch (e) {
			expectedError = e;
		}

		assert.isDefined(expectedError);
		assert.instanceOf(expectedError, SourceProvider.CommunicationError);
		assert.equal((expectedError as SourceProvider.CommunicationError).message, "Test fake error. Emulate no connection");
		// Check count run method
		assert.equal(workCount, 1);
		// Check canсel token
		assert.equal(workToken, DUMMY_CANCELLATION_TOKEN);
		// Check args
		assert.isObject(workArgs);
		if (workArgs && "method" in workArgs && "url" in workArgs) {
			assert.equal(workArgs.method, "GET");

			const url = workArgs.url;
			assert.equal(url.protocol, "https:");
			assert.equal(url.host, "min-api.cryptocompare.com");
			assert.equal(url.pathname, "/data/pricehistorical");
			assert.equal(url.href, "https://min-api.cryptocompare.com/data/pricehistorical?fsym=XYI9CECOIN&tsyms=BADCOIN&ts=1546300800");
		} else {
			assert.fail();
		}
	});





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
});
