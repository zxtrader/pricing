# Cryptopay's Kubernetes Deployment

## Именование тегов

### Database Releases

Tag name format: `DB-<DB_VERSION>`

Создание тега в таком формает, создаст pipeline с набором задач для деплоймента базы версии `DB_VERSION`.
Например:
* [DB-v02.00](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.00)
* [DB-v02.01](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.01)
* etc

NOTE! Перед созданием тега, вы должны убедиться, что [релизные контейнеры](https://gitlab.wnb:28443/cryptopay/database/pipelines) с версией [`DB_VERSION`](https://gitlab.wnb:28443/cryptopay/database/-/tags) выложены в репозитории контейнеров (прод контейнер в продовский репозиторий)

### Database Devel

Запустите Pipeline с переменной `DEVEL_DB_IMAGE_TAG` = `dev.57e5a60e`, где [`dev.57e5a60e`](https://gitlab.wnb:28443/cryptopay/database/pipelines) тег от образа с миграцией базы данных.

Пример триггера
```bash
curl --insecure -X POST -F "token=$DEPLOY_PIPELINE_TOKEN" -F "ref=master" -F "variables[DEVEL_DB_IMAGE_TAG]=dev.57e5a60e" https://gitlab.wnb:28443/api/v4/projects/684/trigger/pipeline
```