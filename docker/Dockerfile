ARG IMAGE=node:11-alpine

FROM ${IMAGE} AS Builder
WORKDIR /build
USER root
COPY .dist/ usr/local/org.zxteam.price/
COPY log4js.json etc/org.zxteam.price/log4js.json
RUN cd usr/local/org.zxteam.price/ && npm install --quiet --production
RUN rm usr/local/org.zxteam.price/.npmrc
RUN mkdir -p etc/org.zxteam.price/ && \
	mv usr/local/org.zxteam.price/price-service.config etc/org.zxteam.price/ && \
	chmod ug+r -R etc/org.zxteam.price && \
	chmod g-w -R etc/org.zxteam.price && \
	chmod o-rwx -R etc/org.zxteam.price && \
	chmod a+r -R usr/local/org.zxteam.price && \
	chmod og-w -R usr/local/org.zxteam.price
COPY docker/price-entrypoint.sh ./

FROM ${IMAGE}
USER node
COPY --from=Builder --chown=root:node /build/ /
EXPOSE 8080
ENV LOG4JS_CONFIG=/etc/org.zxteam.price/log4js.json
ENTRYPOINT ["/price-entrypoint.sh"]
CMD ["price"]
