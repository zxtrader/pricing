FROM node:10

RUN wget http://download.redis.io/redis-stable.tar.gz && \
    tar xvzf redis-stable.tar.gz && \
    cd redis-stable && \
    make && \
    mv src/redis-server /usr/bin/ && \
    cd .. && \
    rm -r redis-stable && \
    npm install -g concurrently

EXPOSE 8080
COPY .dist /usr/local/com.zxtrader.price
COPY config.ini /usr/local/com.zxtrader.price/lib/

RUN npm install

CMD concurrently "/usr/bin/redis-server --bind '0.0.0.0'" "sleep 5s; node lib/app.js"
