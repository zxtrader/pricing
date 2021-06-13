# TODO Checklist

## Production

* runtime.rabbitmq.url прописать хост RabbitMQ с неймспейсом (сервисы переезжаю в другой неймспейс): sed -i 's/rabbitmq/rabbitmq.cryptopay/g' 
* runtime.redis.url прописать хост Redis с неймспейсом (сервисы переезжаю в другой неймспейс): sed -i 's/redis-processing/redis-processing.cryptopay/g'
* в секретах messengerbridge сделать замену путей: sed -i 's~/etc/cexiolabs/cryptopay/ssl/tls.~/etc/cexiolabs/cexiopay/ssl/tls.~g'
