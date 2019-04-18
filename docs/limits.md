# Limits
- Лимиты к сервису можно устанавливать в конфигурационный INI файл.
- Включить лимиты на сервис можно параметром limit.use=true, после включение лимитов вы можете создать профайл (тип пользователя) и указать ему настройки.
- Каждый endpoint имеет свой вес, также он может зависит от количество переданных параметров.
- Ошибка 429 будет возвращено в случае нарушения любого ограничения лимита.

# Основные настройки:
| Name | Type | Description |
| - | - | - |
| limit.use | boolean | Включение\выключение ограничение по лимитным запросам
| limit.profile | boolean | Включение\выключение ограничение по лимитам на категорию пользователя
| limit.profile.weight | number | Общие количество весса
| limit.profile.perSecond | number | Максимальное количество запросов в секунду
| limit.profile.perMinute | number | Максимальное количество запросов в минуту
| limit.profile.perHour | number | Максимальное количество запросов в час
| limit.profile.parallel | number | Максимальное количество запросов паралельно

# Example INI file:
```bash
limit.use=true

// Настройки обычного пользователя
limit.user=true
limit.user.weight=800
limit.user.perSecond=10
limit.user.perMinute=600
limit.user.perHour=36000
limit.user.parallel=2

// Настройки premium пользователя без органичений
limit.premium=true
limit.premium.weight=0
limit.premium.perSecond=0
limit.premium.perMinute=0
limit.premium.perHour=0
limit.premium.parallel=0
```
