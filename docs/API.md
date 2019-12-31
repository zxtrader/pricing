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
{"jsonrpc":"2.0","id":42,"method":"unsubscribe","params":["token-ETH-USD","token-BTC-USD"]}

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
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"price","threshold":250,"opts":{"pairs":["BTC/USD","BTC/USDC","BTC/EUR","ETH/USD","ETH/USDC","ETH/EUR","ETH/BTC","LTC/BTC"]}}}
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"price","threshold":250,"opts":{"pairs":["BTC/USD","BTC/USDC","BTC/EUR","ETH/USD","ETH/USDC","ETH/EUR","ETH/BTC","LTC/BTC"],"exchanges":["BINANCE","POLONIEX"]}}}
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
