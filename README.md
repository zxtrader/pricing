# ZXTrader's Price Service

ZXTrader's Price Service - Service of historical prices. Service is a caching aggregator of prices from few sources. Can working two mode the Demand (caching only the requested data) and Sync (full caching).

## Application schema architecture

![Application schema](docs/price-service-diagram.png)

### Configuration file

```ini
servers = 0 1

server.0.listenHost = localhost
server.0.listenPort = 8080
server.0.type = http

server.1.listenHost = 0.0.0.0
server.1.listenPort = 8443
server.1.type = https
server.1.caCertificate = /path/to/ca.crt
server.1.serverKey = /path/to/server.key
server.1.serverCertificate = /path/to/server.crt
#server.1.serviceKeyPassword =
server.1.clientCertificateMode = none


endpoints = 0 1

endpoint.0.type = rest
endpoint.0.servers = 0
endpoint.0.bindPath = /api
endpoint.0.bindPathWeb = /html

endpoint.1.type = websocket
endpoint.1.servers = 0
endpoint.1.bindPath = /ws


# Settings connection to database
dataStorageURL = redis://localhost:6379/0?ip_family=4&name=PriceService&prefix=priceserv%3A

# List source providers
sources = CRYPTOCOMPARE POLONIEX BINANCE

# Setting source provider CRYPTOCOMPARE. See for limits : https://min-api.cryptocompare.com/stats/rate/limit
source.CRYPTOCOMPARE.limit.parallel = 5
source.CRYPTOCOMPARE.limit.perSecond = 15
source.CRYPTOCOMPARE.limit.perMinute = 300
source.CRYPTOCOMPARE.limit.perHour = 8000
source.CRYPTOCOMPARE.timeout = 3000
```

## How to launch the service

### As Docker container

```bash
docker build --tag zxtrader.price.service . -f Dockerfile.redis
docker run --name zxtrader.price.service --rm -p 8080:8080 --detach zxtrader.price.service:latest
```

### Build from sources
```bash
npm install
npm run build
npm run test
npm run start
```

## How to use the service

### REST API HTTP(S)

## Methods

* Ping - [Ping](#ping) check status service.
* Single - [Historical rate (single)](#Historical-rate-(single)) Return single price or null.
* Batch - [Historical rates (batch)](#Historical-rates-(batch)) Return list key - prices.
* Multi sources - [Multi price from sources](#Multi-price-from-sources) Price from al sources.
* From source - [Price from source system](#Price-from-source-system) Price by one source system.
* Avarage - [Avarage price](#Avarage-price) Return avarage price all sources.
* Multi - [Multi request](#Multi-request) Return prices from all sources and avg price.

### Ping

Check status service.

#### REST

```bash
$ curl --verbose https://service.zxtrader.com/v0/api/ping?echo=hello

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
wscat --connect wss://service.zxtrader.com/v0/ws/jsonrpc
```

```json
connected (press CTRL+C to quit)
> {"jsonrpc":"2.0","id":42,"method":"ping","params":{"echo":"hello"}}
< {"jsonrpc":"2.0","id":42,"result":{"echo":"hello","time":"2019-06-25T17:24:32.660Z","version":"0.31.3"}}
```

### Historical rate (single)

Get a historical rate

#### REST

* Date timezone: UTC
* Date format: YYYYMMDDHHmmss
* Response will be `null` if the service does not have rate value

```bash
curl --verbose --key license.key --cert license.crt https://service.zxtrader.com/v1/rate/single?exchange=BINANCE&date=20190627002015&market=USDT&trade=BTC
```

```bash
"13369.94000000"
```

or

```bash
null
```

#### JSON-RPC

```json
> {"jsonrpc":"2.0","id":42,"method":"rate/single","params": {"exchange": "BINANCE", "date": "20190701102010", "market": "BTC", "trade": "ZEC"}}
< {
    "jsonrpc":"2.0",
    "id":42,
    "result": "65.2312356"
}
```

or

```json
< {
    "jsonrpc":"2.0",
    "id":42,
    "result": null
}
```

### Historical rates (batch)

Get batch of historical rates

* Date timezone: UTC
* Date format: YYYYMMDDHHmmss
* Response will be `null` if the service does not have rate value

#### REST

```bash
curl --verbose --key license.key --cert license.crt https://service.zxtrader.com/v1/rate/batch?items=20180101102010:BTC:ZEC,20180101102020:BTC:ETH,20180101102020:USDT:BTC
```

```json
{
    "20180101102010:BTC:ZEC": "65.2312356",
    "20180101102020:BTC:ETH": "122.348754",
    "20180101102020:USDT:BTC": null
}
```

#### JSON-RPC

```json
--> {"jsonrpc":"2.0","id":42,"method":"rate/batch","params": ["20180101102010:BTC:ZEC","20180101102020:BTC:ETH","20180101102020:USDT:BTC"]}
```

```json
<-- {
    "jsonrpc":"2.0",
    "id":42,
    "result": {
        "20180101102010:BTC:ZEC": "65.2312356",
        "20180101102020:BTC:ETH": "122.348754",
        "20180101102020:USDT:BTC": null
    }
}
```

### Multi price from sources

HTTP Query grammar looks like [(see complete grammar)](docs/http-query-grammar.md):
[![Query grammar](docs/http-query-grammar/QUERY.png)](docs/http-query-grammar.md)

#### REST

Get prices from all sources

```bash
curl --header 'Accept: application/json' https://service.zxtrader.com/price/v1/20180808190523:USDT:BTC:
```

```json
{
    "20180808190523": {
        "USD": {
            "BTC": {
                "avg": {
                    "price": "6310.9138343"
                },
                "sources": {
                    "CRYPTOCOMPARE": {
                        "price": "6311.69"
                    },
                    "ZXTRADER": {
                        "price": "6310.4138285"
                    }
                }
            }
        }
    }
}
```

#### JSON-RPC

```json
JSON-RPC don't implemented yet.
```

### Price from source system

Get price from one source system example CRYPTOCOMPARE

#### REST

```json
curl --header 'Accept: application/json' https://service.zxtrader.com/price/v1/20180808190523:USDT:BTC:CRYPTOCOMPARE
```

```json
{
    "20180808190523": {
        "USD": {
            "BTC": {
                "avg": {
                    "price": "6310.9138343"
                },
                "sources": {
                    "CRYPTOCOMPARE": {
                        "price": "6311.69"
                    }
                }
            }
        }
    }
}
```

#### JSON-RPC

```json
JSON-RPC don't implemented yet.
```

### Avarage price

Get avarage price without sources system

#### REST

```json
curl --header 'Accept: application/json' https://service.zxtrader.com/price/v1/20180808190523:USDT:BTC
```

```json
{
    "20180808190523": {
        "USD": {
            "BTC": {
                "avg": {
                    "price": "6310.9138343"
                }
            }
        }
    }
}
```

#### JSON-RPC

```json
JSON-RPC don't implemented yet.
```

### Multi request

Multi request from all sources

#### REST

```json
curl --header 'Accept: application/json' https://service.zxtrader.com/price/v1/20180808190523:USDT:BTC,20180808190523:USDT:ETH:,20180808190523:USDT:ZEC:CRYPTOCOMPARE
```

```json
{
    "20180808190523": {
        "USDT": {
            "BTC": {
                "avg": {
                    "price": "6300.8379428533335"
                }
            },
            "ETH": {
                "avg": {
                    "price": "357.95608886499997"
                },
                "sources": {
                    "CRYPTOCOMPARE": {
                        "price": "355.35"
                    },
                    "BINANCE": {
                        "price": "360.72"
                    },
                    "POLONIEX": {
                        "price": "360.40435546"
                    }
                }
            },
            "ZEC": {
                "avg": {
                    "price": "159.47"
                },
                "sources": {
                    "CRYPTOCOMPARE": {
                        "price": "159.47"
                    }
                }
            }
        }
    }
}
```

#### JSON-RPC

```json
JSON-RPC don't implemented yet.
```

## How to extend the service with a new source provider

All of you need is to write own implementation of a source provider interface and place in into `src/providers` directory. Take a look at the source provider interface in `src/providers/source/contract.ts`. Use `src/providers/source/random.ts` as example.

## Data storage format in Redis

### Save price for source system

```Bash
HSET "${PREFIX}:${TS}:${MASTER_CURRENCY}:${PRICE_CURRENCY}:${SOURCE_SYSTEM}" "price" ${PRICE}
```

* ${PREFIX} - constant "priceserv"
* ${TS} - time by price. format: YYYYMMDDHHMMSS
* ${MASTER_CURRENCY} - master currency code
* ${PRICE_CURRENCY} - price currency code
* ${SOURCE_SYSTEM} - source system name
* "price" - field name in the database
* ${PRICE} - price from source system

Example:

```Bash
HSET "priceserv:20180101100001:USDT:BTC:CRYPTOCOMPARE" "price" 13400.89
```

### Save average price for all sources system

```Bash
HSET "${PREFIX}:${TS}:${MASTER_CURRENCY}:${PRICE_CURRENCY}" "price" ${AVG_PRICE}
```

* ${PREFIX} - constant "priceserv"
* ${TS} - time by price. format: YYYYMMDDHHMMSS
* ${MASTER_CURRENCY} - master currency code
* ${PRICE_CURRENCY} - price currency code
* "price" - field name in the database
* ${AVG_PRICE} - average price from all sources

Example:

```Bash
HSET "priceserv:20180101100001:USDT:BTC" "price" 13400.89
```

### Save source system name with pair

```Bash
HSET "${PREFIX}:${TS}:${MASTER_CURRENCY}:${PRICE_CURRENCY}" ${SOURCE_SYSTEM}
```

* ${PREFIX} - constant "priceserv"
* ${TS} - time by price. format: YYYYMMDDHHMMSS
* ${MASTER_CURRENCY} - master currency code
* ${PRICE_CURRENCY} - price currency code
* ${SOURCE_SYSTEM} - source system name

Example:

```Bash
HSET "priceserv:20180101100001:USDT:BTC" "CRYPTOCOMPARE"
```

## HTTP status code

* HTTP 200 return code when request successful.
* HTTP 404 return code when not found page.
* HTTP 429 return code is used when breaking a request rate limit.
* HTTP 500 return codes are used for internal errors; the issue is on service's side.
