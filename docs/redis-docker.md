docker kill redis-price-service-test;  docker rm redis-price-service-test;  docker run --name redis-price-service-test --detach --rm --publish 6379:6379 redis
