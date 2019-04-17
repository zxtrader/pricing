# ZXTrader's Price Service Russian version

ZXTrader Price Service - это сервис, который агрегирует исторические цены по крипто-валютам с других сайтов\приложений и предоставляет универсальный API для получения этих данных.

# Как запустить сервис
## Build
```bash
$ npm insatall
$ npm run build
```
## Launch
After build
```bash
$ npm run start
```
Или
```bash
$ node src/index.js
```

# Как использовать сервис
## Апи запросы

Для того что бы получить цену из сервиса по какой-то валютной паре вам не обходимо обратить к сервису через API.

Пример обращение:
```bash
GET: localhost:8580/v1/price/1555497726:USDT:BTC:CRYPTOCOMPARE
```
| Часть URL  | Тип | Описание |
| ------------- | ------------- | ------------- |
| localhost | string |  Сервис хост |
| 8580 | number | Сервис порт |
| /v1/price/ | string | Путь |
| 1555497726 | unixtime | Время за которой нужно получить цену |
| USDT | string | Маркет валюта |
| BTC | string | Трейд валюта |
| CRYPTOCOMPARE | string | С какого источника получить цену (не обязательный) |

Ответ от сервера:
```json
{
	"1555497726": {
		"USDT": {
			"BTC": {
				"avg": {
					"price": "13400.89"
				},
				"sources": {
					"CRYPTOCOMPARE": {
						"price": "13400.89"
					}
				}
			}
		}
	}
}
```

Также можно делать мульти запросы:
```bash
GET: https://localhost:8580/v1/history/price/1555497726:USDT:BTC:CRYPTOCOMPARE,1555497726:USDT:ETH,1555497726:USDT:ZEC
```

Ответ от сервиса:
```json
{
	"1555497726": {
		"USDT": {
			"BTC": {
				"avg": {
					"price": "13400.89"
				},
				"sources": {
					"CRYPTOCOMPARE": {
						"price": "13400.89"
					}
				}
			},
			"ETH": {
				"avg": {
					"price": "754.8599999999999"
				}
			}
		}
	},
	"1555497826": {
		"USDT": {
			"ZEC": {
				"avg": "63.344444"
				}
			}
		}
	}
}
```

# Как подключить источник для агрегации цен
Нужно реализовать имплементацию сервис-плагин контракта и подключить как плагин к данному сервису.

Контракт плагина
```bash
$ contract/plugin.ts
```
Исходники плагина:
```bash
$ src/plugin/*.ts
```
