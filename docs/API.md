
# API
The service supports following endponts:
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
$ curl --verbose "https://service.zxtrader.com/price/v0/api/ping?echo=hello"
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
wscat --connect wss://service.zxtrader.com/price/v0/ws
```
```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"ping","params":{"echo":"hello"}}
< {"jsonrpc":"2.0","id":42,"result":{"echo":"hello","time":"2019-07-14T22:15:38.410Z","version":"0.0.17"}}
```

### Historical rate
Get a historical rate
#### REST
* Date timezone: UTC
* Date format: YYYYMMDDHHmmss
* Response will be `null` if the service does not have rate value
* Arguments
  * `marketCurrency` - a currency code of base asset
  * `tradeCurrency` - a currency code of price asset
  * `date` - (optional) date in format YYYYMMDDHHmmss. Using now() if omited.
```bash
curl "https://service.zxtrader.com/price/v0/api/rate?marketCurrency=USDT&tradeCurrency=BTC&date=20190627002015"
```
```json
"13369.94000000"
```
or
```json
null
```
#### JSON-RPC
```bash
wscat --connect wss://service.zxtrader.com/price/v0/ws
```
```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"USDT","tradeCurrency":"BTC","date":"2019-07-01T10:20:33"}}
< {"jsonrpc":"2.0","id":42,"result":"0.00945900"}
> {"jsonrpc":"2.0","id":42,"method":"rate","params":{"marketCurrency":"USDT","tradeCurrency":"BTC"}}
< {"jsonrpc":"2.0","id":42,"result":"0.00945900"}
```
or
```json
< {"jsonrpc":"2.0","id":42,"result": null}
```

### Subscribe (make subscription)
Subscribe for the topic
#### REST
Not supported yet
#### JSON-RPC
```bash
wscat --connect wss://service.zxtrader.com/price/v0/ws
```
```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"NAME_OF_TOPIC",opts:{...TOPIC's opts...}}}
< {"jsonrpc":"2.0","id":42,"result":"token-97EFBC0C"}
```

### Subsсiptions list
Get a list of the subscribed topics
#### REST
Not supported yet
#### JSON-RPC
```bash
wscat --connect wss://service.zxtrader.com/price/v0/ws
```
```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"subsсiptions"}
< {"jsonrpc":"2.0","id":42,"result":{"token-97EFBC0C":{...subscribe-opts...},"token-9926BCAC":{...subscribe-opts...}}}
```

### Unsubscribe (destroy subscription)
#### REST
Not supported yet
#### JSON-RPC
```bash
wscat --connect wss://service.zxtrader.com/price/v0/ws
```
```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"unsubscribe","params":"token-97EFBC0C"}
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
#### JSON-RPC
```bash
wscat --connect wss://service.zxtrader.com/price/v0/ws
```
```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"subscribe","params":{"topic":"rate","threshold":250,"opts":{"marketCurrency":"USD","tradeCurrency":"BTC"}}}
< {"jsonrpc":"2.0","id":42,"result":"token-97"}
< {"jsonrpc":"2.0","method":"notification","params":{"token":"token-97","data":{"date":"2019-06-11T16:41:29.502Z","rate":"7993.42"}}}
< {"jsonrpc":"2.0","method":"notification","params":{"token":"token-97","data":{"date":"2019-06-11T16:41:29.752Z","rate":"7996.11"}}}
< {"jsonrpc":"2.0","method":"notification","params":{"token":"token-97","data":{"date":"2019-06-11T16:41:30.002Z","rate":"7995.26"}}}
```
