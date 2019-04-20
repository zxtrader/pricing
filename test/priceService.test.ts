import { assert } from "chai";
import { StorageProvider } from "../src/providers/storage/contract";
import { SourceProvider } from "../src/providers/source/contract";
import { PriceService, price } from "../src/PriceService";

describe("Test Price-service", function () {
	let priceService: PriceService;
	let storageProvider: StorageProvider;
	let sourceProvider: SourceProvider;
	beforeEach(async function () {
		// priceService = new PriceService();
	});
	it("Test 42 equal 42", function () {
		const args: Array<price.Argument> = [
			{
				marketCurrency: "USDT",
				tradeCurrency: "BTC",
				ts: 20180101101010,
				sourceSystemId: "cryptocompare",
				requiredAllSourceSystems: false
			},
			{
				marketCurrency: "USDT",
				tradeCurrency: "ETH",
				ts: 20180101101020,
				sourceSystemId: "cryptocompare",
				requiredAllSourceSystems: true
			}
		];
		const pricePrice: price.Prices = {
			20180101101010: {
				"USDT": {
					"BTC": {
						avg: null
					}
				}
			},
			20180101101020: {
				"USDT": {
					"ETH": {
						avg: {
							price: "150"
						},
						sources: {
							"CRYPTOCOMPARE": {
								price: "150"
							}
						}
					}
				}
			}
		};
		const loadDataRequest: price.LoadDataRequest = {
			"CRYPTOCOMPARE": {
				20180101101010: {
					"BTC": ["USDT", "ETH"]
				}
			}
		};

		assert.equal("42", "42");
	});
});
