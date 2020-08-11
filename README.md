# Cryptopay's Kubernetes Deployment

## Именование тегов

### HELM Chart Releases

Tag name format: `runtime-<APP_VERSION>`

Создание тега в таком формате, создаст pipeline с набором задач для деплоймента сервисов. `APP_VERSION` это версия Chart.yaml `appVersion`.

Например:
* [runtime-2.0.0-alpha01](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/runtime-2.0.0-alpha01)
* [runtime-2.0.1](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/runtime-2.0.1)
* etc

NOTE! Перед созданием тега, вы должны убедиться, что релизные контейнеры сервисов выложены в репозитории контейнеров (прод контейнер в продовский репозиторий)

### Database Releases

Tag name format: `DB-<DB_VERSION>`

Создание тега в таком формате, создаст pipeline с набором задач для деплоймента базы версии `DB_VERSION`.
Например:
* [DB-v02.00](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.00)
* [DB-v02.01](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.01)
* etc

NOTE! Перед созданием тега, вы должны убедиться, что [релизные контейнеры](https://gitlab.wnb:28443/cryptopay/database/pipelines) с версией [`DB_VERSION`](https://gitlab.wnb:28443/cryptopay/database/-/tags) выложены в репозитории контейнеров (прод контейнер в продовский репозиторий)


### HELM Chart Devel

Запустите Pipeline с переменной `DEVEL_RUNTIME` со значением = `master` или `dev`. Это создаст pipeline с набором задач для деплоймента сервисов из соответсвующих бранчей.

### Database Devel

Запустите Pipeline с переменной `DEVEL_DB_IMAGE_TAG` = `dev.57e5a60e`, где [`dev.57e5a60e`](https://gitlab.wnb:28443/cryptopay/database/pipelines) тег от образа с миграцией базы данных.

Пример триггера
```bash
curl --insecure -X POST -F "token=$DEPLOY_PIPELINE_TOKEN" -F "ref=master" -F "variables[DEVEL_DB_IMAGE_TAG]=dev.57e5a60e" https://gitlab.wnb:28443/api/v4/projects/684/trigger/pipeline
```

 devdocker.infra.kube/cryptopay/cpservice-devel:dev.f1bddd7b