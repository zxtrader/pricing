# Docker Image

## Build manually

Execute following at project root:

```shell
export CI_PROJECT_URL=https://dev.zxteam.net/zxtrader/price.service
export CI_COMMIT_REF_NAME=workcopy
export CI_JOB_URL=http://localhost
export CI_COMMIT_SHORT_SHA=00000000
export CI_COMMIT_TIMESTAMP=2021-03-07T12:26:30.582505Z
export BUILD_CONFIGURATION=snapshot  # snapshot or release
```

ARM Build (MacBook Air)

```shell
docker build --tag zxteam-pricing \
  --build-arg BUILD_CONFIGURATION \
  --build-arg CI_COMMIT_REF_NAME \
  --build-arg CI_COMMIT_SHORT_SHA \
  --build-arg CI_JOB_URL \
  --build-arg CI_PROJECT_URL \
  --build-arg CI_COMMIT_TIMESTAMP \
  --file docker/Dockerfile \
  .
```

## Run manually

```bash
docker run --rm --interactive --tty  --entrypoint /bin/sh --publish 127.0.0.1:8080:8080 zxteam-pricing 
docker run --rm --publish 127.0.0.1:8080:8080 zxteam-pricing
```
