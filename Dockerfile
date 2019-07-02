ARG IMAGE=node:11-alpine

FROM ${IMAGE} AS Builder
ARG TARGET=release
WORKDIR /build
COPY .dist/ usr/local/com.zxtrader.price/
COPY .npmrc usr/local/com.zxtrader.price/
COPY config.${TARGET}.ini etc/com.zxtrader.price/config.ini
COPY log4js.${TARGET}.json etc/com.zxtrader.price/log4js.json
RUN cd usr/local/com.zxtrader.price/ && npm install --quiet --production
RUN rm usr/local/com.zxtrader.price/.npmrc && \
	chown root:root -R etc/com.zxtrader.price && \
	chmod a+r -R etc/com.zxtrader.price && \
	chmod og-w -R etc/com.zxtrader.price && \
	chown root:root -R usr/local/com.zxtrader.price && \
	chmod a+r -R usr/local/com.zxtrader.price && \
	chmod og-w -R usr/local/com.zxtrader.price 

FROM ${IMAGE}
COPY --from=Builder /build/ /
USER node
EXPOSE 8080
ENV LOG4JS_CONFIG=/etc/com.zxtrader.price/log4js.json MONITORING_URL=null://
CMD ["node", "/usr/local/com.zxtrader.price/lib/app.js", "--config=/etc/com.zxtrader.price/config.ini"]
