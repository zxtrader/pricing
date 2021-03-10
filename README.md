# Cryptopay's Kubernetes Deployment

## Releases

Pipelines для релизов формируются с помощью создания тега с соответствущим префиксом.

### Runtime Releases

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
* [DB-v02.00](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/database-v02.00)
* [DB-v02.01](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/database-v02.01)
* etc

NOTE! Перед созданием тега, вы должны убедиться, что [релизные контейнеры](https://gitlab.wnb:28443/cryptopay/database/pipelines) с версией [`DB_VERSION`](https://gitlab.wnb:28443/cryptopay/database/-/tags) выложены в репозитории контейнеров (прод контейнер в продовский репозиторий)

## Snapshots

### Runtime Snapshot

Запустите Pipeline с переменной `SNAPSHOT_RUNTIME` со значением = `master` или `dev`. Это создаст pipeline с набором задач для деплоймента сервисов из соответсвующего бранчей.

Пример триггера
```bash
export DEPLOY_PIPELINE_TOKEN=...
curl --insecure -X POST -F "token=${DEPLOY_PIPELINE_TOKEN}" -F "ref=master" -F "variables[SNAPSHOT_RUNTIME]=dev" https://gitlab.wnb:28443/api/v4/projects/684/trigger/pipeline
```
### Database Snapshot

Запустите Pipeline с переменной `SNAPSHOT_DATABASE` = `dev.57e5a60e`, где [`dev.57e5a60e`](https://gitlab.wnb:28443/cryptopay/database/pipelines) тег от образа с миграцией базы данных.

Пример триггера
```bash
export DEPLOY_PIPELINE_TOKEN=...
curl --insecure -X POST -F "token=${DEPLOY_PIPELINE_TOKEN}" -F "ref=master" -F "variables[SNAPSHOT_DATABASE]=dev.57e5a60e" https://gitlab.wnb:28443/api/v4/projects/684/trigger/pipeline
```


## HELM Notes

### Get started
1. Make configuration file for `kubectl` application (setup ~/.kube/config)
1. Set alias to HELM
	```bash
	$ cd_cryptopay
	$ cd devops.kubernetes-deployment/runtime/
	# Set "helm" docker alias if you does not have Helm locally. Choose one of following:
	$ alias helm="docker run --interactive --tty --rm --volume \"${HOME}/.kube/config:/root/.kube/config\" --volume \"$(pwd):/apps\" --entrypoint /usr/bin/helm harbor.infra.kube/infra/helm:3"
	$ alias helm="docker run --interactive --tty --rm --volume \"${HOME}/.kube/config:/root/.kube/config\" --volume \"$(pwd):/apps\" alpine/helm:3.2.0"
	```
1. Set environment
	```bash
	$ export ENV=evolution
	$ export ENV=presentation
	$ export ENV=preproduction
	```
### Useful commands
See full doc https://v3.helm.sh/docs/helm

#### List
```bash
$ helm --namespace "cryptopay-${ENV}" list --all
NAME             	REVISION	UPDATED                 	STATUS  	CHART                  	APP VERSION	NAMESPACE
???
```

#### Delete the release from Kubernetes
Full delete `tag` for example
```bash
$ helm --namespace "cryptopay-${ENV}" uninstall tag
```

#### Deploy the service into cluster
```bash
$ helm --namespace "cryptopay-${ENV}" upgrade --install --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" tag .
```

```bash
$ helm --namespace "cryptopay-${ENV}" upgrade --install --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" --set "application.api.tag=master" tag .
```

```bash
$ helm --namespace "cryptopay-${ENV}" upgrade --install --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" --set "application.processing.tag=master" --set "application.api.tag=master" tag .
```


## Kubectl Notes

### Get started
1. Make configuration file for `kubectl` application (setup ~/.kube/config)

### Backup all secrets

```bash
kubectl --namespace=cryptopay-evolution get --output=yaml secrets | tee bakup-cryptopay-evolution-secrets.yaml
```
