FROM node:10-alpine

EXPOSE 8080
COPY .dist /usr/local/com.zxtrader.price
COPY log4js.json /etc/com.zxtrader.price/

WORKDIR /usr/local/com.zxtrader.price

CMD ["node", "lib/app.js", "--config=/etc/com.zxtrader.price/log4js.json"]

