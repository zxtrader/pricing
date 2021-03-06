# ZXTrader's Price Service
ZXTrader's Price Service - Service of historical prices. Service is a caching aggregator of prices from a lot of sources.

## Quick Start
* Create virtual network
    ```bash
    docker network create priceservice
    ```
* Start a Redis server. Thee Redis is used as memory database for store historical prices
    ```bash
    docker run --rm --interactive --tty --network=priceservice redis:4
    ```
* Start *Price Service* itself
    ```bash
    docker run --rm --interactive --tty --network=priceservice --publish 28080:8080 --entrypoint /usr/local/bin/node docker.registry.zxteam.net/zxtrader/price.service:0.0.30 /usr/local/org.zxteam.price/bin/price-service.js --config-file=/etc/org.zxteam.price/price-service.config
    ```

## API
Find [API](docs/API.md) notes in separate document

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
