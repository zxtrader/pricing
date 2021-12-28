ARG IMAGE=node:16-alpine

FROM ${IMAGE} AS node-builder
# Like snapshot/snapshot-mockup/release
ARG BUILD_CONFIGURATION="release"
# Like dev/master/1.0.0
ARG CI_COMMIT_REF_NAME=
# Like 36622b40
ARG CI_COMMIT_SHORT_SHA=
# Like https://dev.zxteam.net/zxtrader/price.service/-/jobs/12345
ARG CI_JOB_URL=
# Like https://dev.zxteam.net/zxtrader/price.service
ARG CI_PROJECT_URL=
# Like 2021-03-07T12:26:30.582505Z
ARG CI_COMMIT_TIMESTAMP=
WORKDIR /build/zxteam.pricing
COPY docker/docker-entrypoint.sh                                                    /stage/usr/local/bin/docker-entrypoint.sh
COPY price-service.config                                                           /stage/etc/zxteam.pricing/price-service.config
COPY package.json package-lock.json tsconfig.json tslint.json .npmrc log4js.json    /build/zxteam.pricing/
COPY package.json package-lock.json .npmrc log4js.json                              /stage/usr/local/cexiolabs/zxteam.pricing/
COPY /bin                                                                           /stage/usr/local/cexiolabs/zxteam.pricing/bin
COPY /src                                                                           /build/zxteam.pricing/src
RUN chmod +x /stage/usr/local/bin/docker-entrypoint.sh
RUN npm install --progress=false
RUN mkdir -p /stage/usr/local/cexiolabs/zxteam.pricing
RUN npx tsc --project tsconfig.json --rootDir /build/zxteam.pricing --outDir /stage/usr/local/cexiolabs/zxteam.pricing
RUN cd /stage/usr/local/cexiolabs/zxteam.pricing/ && npm install --production --progress=false && rm package-lock.json .npmrc

# USER root
# COPY .dist/ usr/local/org.zxteam.price/
# COPY log4js.json etc/org.zxteam.price/log4js.json
# RUN cd usr/local/org.zxteam.price/ && npm install --quiet --production
# RUN rm usr/local/org.zxteam.price/.npmrc
# RUN mkdir -p etc/org.zxteam.price/ && \
# 	mv usr/local/org.zxteam.price/price-service.config etc/org.zxteam.price/ && \
# 	chmod ug+r -R etc/org.zxteam.price && \
# 	chmod g-w -R etc/org.zxteam.price && \
# 	chmod o-rwx -R etc/org.zxteam.price && \
# 	chmod a+r -R usr/local/org.zxteam.price && \
# 	chmod og-w -R usr/local/org.zxteam.price
# COPY docker/price-entrypoint.sh ./



FROM ${IMAGE}
USER node
COPY --from=node-builder /stage /
WORKDIR /usr/local/cexiolabs/zxteam.pricing/
EXPOSE 8080
# ENV LOG4JS_CONFIG=/etc/org.zxteam.price/log4js.json
USER node
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

