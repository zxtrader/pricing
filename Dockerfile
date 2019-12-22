ARG IMAGE=node:11-alpine

FROM ${IMAGE} AS Builder
WORKDIR /build
COPY .dist/ usr/local/com.zxtrader.price-service/
COPY .npmrc usr/local/com.zxtrader.price-service/
COPY price-service.config etc/com.zxtrader.price-service/price-service.config
COPY log4js.json etc/com.zxtrader.price-service/log4js.json
RUN cd usr/local/com.zxtrader.price-service/ && npm install --quiet --production
RUN rm usr/local/com.zxtrader.price-service/.npmrc && \
	chown root:root -R etc/com.zxtrader.price-service && \
	chmod a+r -R etc/com.zxtrader.price-service && \
	chmod og-w -R etc/com.zxtrader.price-service && \
	chown root:root -R usr/local/com.zxtrader.price-service && \
	chmod a+r -R usr/local/com.zxtrader.price-service && \
	chmod og-w -R usr/local/com.zxtrader.price-service 

FROM ${IMAGE}
COPY --from=Builder /build/ /
USER node
EXPOSE 8080
ENV LOG4JS_CONFIG=/etc/com.zxtrader.price-service/log4js.json MONITORING_URL=null://
CMD ["node", "/usr/local/com.zxtrader.price-service/lib/app.js", "--config=/etc/com.zxtrader.price-service/price-service.config"]
