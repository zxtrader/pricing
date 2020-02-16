# API
The service supports following endpoints:

| Type                                                                                                                          | Description                               |
|-------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------|
| [REST](https://en.wikipedia.org/wiki/Representational_state_transfer)                                                         | https://service.zxtrader.com/price/v0/api |
| [WebSocket](https://en.wikipedia.org/wiki/WebSocket) + [JSONRPC](https://www.jsonrpc.org/specification)                       | wss://service.zxtrader.com/price/v0/ws    |
| [WebSocket](https://en.wikipedia.org/wiki/WebSocket) + [Protobuf2](https://developers.google.com/protocol-buffers/docs/proto) | Not implemented yet                       |
| [gRPC](https://grpc.io/)                                                                                                      | Not implemented yet                       |

## Methods
* [Ping](#ping) - check status service.
* [Rate](#Historical-rate) - return single price or null.
* [Subscribe](#Subscribe-(make-subscription)) - return single price or null.
* [Subsсiptions list](#Subsсiptions-list) - return single price or null.
* [Unsubscribe](#Unsubscribe-(destroy-subscription)) - return single price or null.

### Ping
Check status service.
#### REST
```bash
$ curl --verbose "http://127.0.0.1:8080/v0/api/ping?echo=hello"
$ curl --verbose "https://api.zxtrader.com/price/v0/api/ping?echo=hello"
$ curl --verbose "https://api-evo.zxtrader.com:20443/price/v0/api/ping?echo=hello"
> GET /ping?echo=hello HTTP/1.1
> Host: ${SERVICE_HOST_NAME}:${SERVICE_PORT}
> Accept: */*
>
< HTTP/1.1 200 OK
```
```json
{"echo":"hello","time":"2019-06-11T16:08:07.713Z","version":"1.0.0"}
```
#### JSON-RPC
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"ping","params":{"echo":"hello"}}
< {"jsonrpc":"2.0","id":42,"result":{"echo":"hello","time":"2019-07-14T22:15:38.410Z","version":"0.0.17"}}
```

### Historical Rate
Get a historical rate
#### REST
* Date timezone: UTC
* Date format: YYYYMMDDHHmmss
* Response will be `null` if the service does not have rate value
* Arguments
  * `marketCurrency` - a currency code of base asset
  * `tradeCurrency` - a currency code of price asset
  * `exchange` - (optional) an identifier of the exchange
  * `date` - (optional) date in format YYYYMMDDHHmmss. Using now() if omited.
```bash
$ curl "http://127.0.0.1:8080/v0/api/rate?marketCurrency=USDT&tradeCurrency=BTC&exchange=BINANCE&date=20190627002015"
$ curl "https://api.zxtrader.com/price/v0/api/rate?marketCurrency=USDT&tradeCurrency=BTC&exchange=BINANCE&date=20190627002015"
$ curl "https://api-evo.zxtrader.com:20443/price/v0/api/rate?marketCurrency=USDT&tradeCurrency=BTC&exchange=BINANCE&date=20190627002015"
```
```json
"13369.94000000"
```
or
```json
null
```
#### JSON-RPC (over WebSocket)
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"USDT","tradeCurrency":"BTC","exchange":"BINANCE","date":"2019-07-01T10:20:33Z"}}
< {"jsonrpc":"2.0","id":42,"result":"0.00945900"}
> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"USDT","tradeCurrency":"BTC","date":"2019-07-01T10:20:33Z"}}
< {"jsonrpc":"2.0","id":42,"result":"0.00945900"}
> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"USDT","tradeCurrency":"BTC"}}
< {"jsonrpc":"2.0","id":42,"result":"0.00945900"}
> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"WRONG_COIN","tradeCurrency":"BAD_COIN"}}
< {"jsonrpc":"2.0","id":42,"result": null}
```

### Historical Rate Detailed
Get a historical rate
#### REST
#### JSON-RPC (over WebSocket)


### Subscribe (make subscription)
Subscribe for the topic
#### REST
Not supported yet
#### JSON-RPC (over WebSocket)
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"NAME_OF_TOPIC",opts:{...TOPIC's opts...}}}
< {"jsonrpc":"2.0","id":42,"result":"token-97EFBC0C"}
```

### Subsсiptions list
Get a list of the subscribed topics
#### REST
Not supported yet
#### JSON-RPC (over WebSocket)
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"subsсiptions"}
< {"jsonrpc":"2.0","id":42,"result":{"token-97EFBC0C":{...subscribe-opts...},"token-9926BCAC":{...subscribe-opts...}}}
```

### Unsubscribe (destroy subscription)
#### REST
Not supported yet
#### JSON-RPC (over WebSocket)
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"unsubscribe","params":["token-97EFBC0C"]}
< {"jsonrpc":"2.0","id":42,"result":true}
```

## Notifications

### Topic "rate"
Отправляется при изменении текущего курса по валютной паре
opts:
* `threshold` - pause in milliseconds between notifications.
* `marketCurrency` - Master currency.
* `tradeCurrency` - Price currency.
* `exchangeId` - (optional) A desired exchange.
#### REST
Not implemented yet
#### JSON-RPC (over WebSocket)
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"rate","threshold":250,"opts":{"marketCurrency":"USD","tradeCurrency":"BTC"}}}
< {"jsonrpc":"2.0","id":42,"result":"token-97"}
< {"jsonrpc":"2.0","method":"notification","params":{"token":"token-97","data":{"date":"2019-06-11T16:41:29.502Z","rate":"7993.42"}}}
< {"jsonrpc":"2.0","method":"notification","params":{"token":"token-97","data":{"date":"2019-06-11T16:41:29.752Z","rate":"7996.11"}}}
< {"jsonrpc":"2.0","method":"notification","params":{"token":"token-97","data":{"date":"2019-06-11T16:41:30.002Z","rate":"7995.26"}}}
```

### Topic "price"
Отправляется при изменении текущего курса по валютной паре
opts:
* `threshold` - pause in milliseconds between notifications.
* `marketCurrency` - Master currency.
* `tradeCurrency` - Price currency.
* `exchangeId` - (optional) A desired exchange.
#### REST
Not implemented yet
#### JSON-RPC (over WebSocket)
```bash
$ wscat --connect ws://127.0.0.1:8080/v0/ws
$ wscat --connect wss://api.zxtrader.com/price/v0/ws
$ wscat --connect wss://api-evo.zxtrader.com:20443/price/v0/ws
connected (press CTRL+C to quit)
```
```json
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"price","threshold":250,"opts":{"pairs":["BTC/USD","BTC/USD","BTC/USDT","BTC/EUR","ETH/USD","ETH/USDC","ETH/EUR","ETH/BTC","LTC/BTC"],"exchanges":["BINANCE","POLONIEX"]}}}
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"price","threshold":2500,"opts":{"pairs":["BTC/USD","ETH/USD","LTC/USD","BNB/USD","NEO/USD","BCC/USD","GAS/USD","HSR/USD","MCO/USD","WTC/USD","LRC/USD","QTUM/USD","YOYO/USD","OMG/USD","ZRX/USD","STRAT/USD","SNGLS/USD","BQX/USD","KNC/USD","FUN/USD","SNM/USD","IOTA/USD","LINK/USD","XVG/USD","SALT/USD","MDA/USD","MTL/USD","SUB/USD","EOS/USD","SNT/USD","ETC/USD","MTH/USD","ENG/USD","DNT/USD","ZEC/USD","BNT/USD","AST/USD","DASH/USD","OAX/USD","ICN/USD","BTG/USD","EVX/USD","REQ/USD","VIB/USD","TRX/USD","POWR/USD","ARK/USD","XRP/USD","MOD/USD","ENJ/USD","STORJ/USD","VEN/USD","KMD/USD","RCN/USD","NULS/USD","RDN/USD","XMR/USD","DLT/USD","AMB/USD","BAT/USD","BCPT/USD","ARN/USD","GVT/USD","CDT/USD","GXS/USD","POE/USD","QSP/USD","BTS/USD","XZC/USD","LSK/USD","TNT/USD","FUEL/USD","MANA/USD","BCD/USD","DGD/USD","ADX/USD","ADA/USD","PPT/USD","CMT/USD","XLM/USD","CND/USD","LEND/USD","WABI/USD","TNB/USD","WAVES/USD","GTO/USD","ICX/USD","OST/USD","ELF/USD","AION/USD","NEBL/USD","BRD/USD","EDO/USD","WINGS/USD","NAV/USD","LUN/USD","TRIG/USD","APPC/USD","VIBE/USD","RLC/USD","INS/USD","PIVX/USD","IOST/USD","CHAT/USD","STEEM/USD","NANO/USD","VIA/USD","BLZ/USD","AE/USD","RPX/USD","NCASH/USD","POA/USD","ZIL/USD","ONT/USD","STORM/USD","XEM/USD","WAN/USD","WPR/USD","QLC/USD","SYS/USD","GRS/USD","CLOAK/USD","GNT/USD","LOOM/USD","BCN/USD","REP/USD","TUSD/USD","ZEN/USD","SKY/USD","CVC/USD","THETA/USD","IOTX/USD","QKC/USD","AGI/USD","NXS/USD","DATA/USD","SC/USD","NPXS/USD","KEY/USD","NAS/USD","MFT/USD","DENT/USD","ARDR/USD","HOT/USD","VET/USD","DOCK/USD","POLY/USD","PHX/USD","HC/USD","GO/USD","PAX/USD","RVN/USD","DCR/USD","MITH/USD","BCHABC/USD","BCHSV/USD","REN/USD","BTT/USD","ONG/USD","FET/USD","CELR/USD","MATIC/USD","ATOM/USD","PHB/USD","TFUEL/USD","ONE/USD","FTM/USD","BTCB/USD","ALGO/USD","ERD/USD","DOGE/USD","DUSK/USD","ANKR/USD","WIN/USD","COS/USD","COCOS/USD","TOMO/USD","PERL/USD","CHZ/USD","BAND/USD","BEAM/USD","XTZ/USD","HBAR/USD","NKN/USD","STX/USD","KAVA/USD","ARPA/USD","CTXC/USD","BCH/USD","TROY/USD","VITE/USD","FTT/USD","USDT/USD","USDC/USD","USDS/USD","USDSB/USD","BUSD/USD","TUSDB/USD","BGBP/USD","NGN/USD","RUB/USD","TRY/USD","BTC/EUR","ETH/EUR","LTC/EUR","BNB/EUR","NEO/EUR","BCC/EUR","GAS/EUR","HSR/EUR","MCO/EUR","WTC/EUR","LRC/EUR","QTUM/EUR","YOYO/EUR","OMG/EUR","ZRX/EUR","STRAT/EUR","SNGLS/EUR","BQX/EUR","KNC/EUR","FUN/EUR","SNM/EUR","IOTA/EUR","LINK/EUR","XVG/EUR","SALT/EUR","MDA/EUR","MTL/EUR","SUB/EUR","EOS/EUR","SNT/EUR","ETC/EUR","MTH/EUR","ENG/EUR","DNT/EUR","ZEC/EUR","BNT/EUR","AST/EUR","DASH/EUR","OAX/EUR","ICN/EUR","BTG/EUR","EVX/EUR","REQ/EUR","VIB/EUR","TRX/EUR","POWR/EUR","ARK/EUR","XRP/EUR","MOD/EUR","ENJ/EUR","STORJ/EUR","VEN/EUR","KMD/EUR","RCN/EUR","NULS/EUR","RDN/EUR","XMR/EUR","DLT/EUR","AMB/EUR","BAT/EUR","BCPT/EUR","ARN/EUR","GVT/EUR","CDT/EUR","GXS/EUR","POE/EUR","QSP/EUR","BTS/EUR","XZC/EUR","LSK/EUR","TNT/EUR","FUEL/EUR","MANA/EUR","BCD/EUR","DGD/EUR","ADX/EUR","ADA/EUR","PPT/EUR","CMT/EUR","XLM/EUR","CND/EUR","LEND/EUR","WABI/EUR","TNB/EUR","WAVES/EUR","GTO/EUR","ICX/EUR","OST/EUR","ELF/EUR","AION/EUR","NEBL/EUR","BRD/EUR","EDO/EUR","WINGS/EUR","NAV/EUR","LUN/EUR","TRIG/EUR","APPC/EUR","VIBE/EUR","RLC/EUR","INS/EUR","PIVX/EUR","IOST/EUR","CHAT/EUR","STEEM/EUR","NANO/EUR","VIA/EUR","BLZ/EUR","AE/EUR","RPX/EUR","NCASH/EUR","POA/EUR","ZIL/EUR","ONT/EUR","STORM/EUR","XEM/EUR","WAN/EUR","WPR/EUR","QLC/EUR","SYS/EUR","GRS/EUR","CLOAK/EUR","GNT/EUR","LOOM/EUR","BCN/EUR","REP/EUR","TUSD/EUR","ZEN/EUR","SKY/EUR","CVC/EUR","THETA/EUR","IOTX/EUR","QKC/EUR","AGI/EUR","NXS/EUR","DATA/EUR","SC/EUR","NPXS/EUR","KEY/EUR","NAS/EUR","MFT/EUR","DENT/EUR","ARDR/EUR","HOT/EUR","VET/EUR","DOCK/EUR","POLY/EUR","PHX/EUR","HC/EUR","GO/EUR","PAX/EUR","RVN/EUR","DCR/EUR","MITH/EUR","BCHABC/EUR","BCHSV/EUR","REN/EUR","BTT/EUR","ONG/EUR","FET/EUR","CELR/EUR","MATIC/EUR","ATOM/EUR","PHB/EUR","TFUEL/EUR","ONE/EUR","FTM/EUR","BTCB/EUR","ALGO/EUR","ERD/EUR","DOGE/EUR","DUSK/EUR","ANKR/EUR","WIN/EUR","COS/EUR","COCOS/EUR","TOMO/EUR","PERL/EUR","CHZ/EUR","BAND/EUR","BEAM/EUR","XTZ/EUR","HBAR/EUR","NKN/EUR","STX/EUR","KAVA/EUR","ARPA/EUR","CTXC/EUR","BCH/EUR","TROY/EUR","VITE/EUR","FTT/EUR","USDT/EUR","USDC/EUR","USDS/EUR","USDSB/EUR","BUSD/EUR","TUSDB/EUR","BGBP/EUR","NGN/EUR","RUB/EUR","TRY/EUR"]}}}
< {"jsonrpc":"2.0","id":42,"result":"token-97"}
< {"jsonrpc":"2.0","method":"token-97","params":{...}}
< {"jsonrpc":"2.0","method":"token-97","params":{...}}
< {"jsonrpc":"2.0","method":"token-97","params":{...}}
```
Where `params` is
```json
{
	"date":"2019-06-11T16:41:29.502Z",
	"prices": {
		"USD": {
			"BTC": {
				"ZXTRADER": "7227.70",
				"BINANCE": "7218.22",
				"POLONIEX": null
			},
			"ETH": {
				"ZXTRADER": "125.56",
				"BINANCE": "125.41",
				"POLONIEX": null
			}
		},
		"USDC": {
			"BTC": {
				"ZXTRADER": "7227.70",
				"BINANCE": null,
				"POLONIEX": "7214.97"
			},
			"ETH": {
				"ZXTRADER": "125.56",
				"BINANCE": null,
				"POLONIEX": "125.72",
			}
		},
		"EUR": {
			"BTC": {
				"ZXTRADER": "6512.62",
				"BINANCE": "6517.09",
				"POLONIEX": null
			},
			"ETH": {
				"ZXTRADER": "112.92",
				"BINANCE": "113.19",
				"POLONIEX": null
			}
		},
		"BTC": {
			"ETH": {
				"ZXTRADER": "0.01739216",
				"BINANCE": "0.01736734",
				"POLONIEX": "0.01738882"
			}
		}
	}
}
```
