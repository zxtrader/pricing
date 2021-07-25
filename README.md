# Cryptopay's Kubernetes Deployment

## Releases

Pipelines для релизов формируются с помощью создания тега с соответствущим суффиксом.

Суффиксы для тегов:

* `-infratest` - Набор задач по деплойменту тестового чарта с использованием `Helm 2/3`
* `-runtime` - Набор задач по деплойменту с использованием `Helm 3`
* `-runtime-helm2` - Набор задач по деплойменту с использованием `Helm 2`
* `-database` -  Набор задач по деплойменту миграций базы данных

### Runtime Helm Releases

**Runtime** - мы называем Helm Chart описывающий сборку всего набора сервисов с привязкой к 

Tag name format: `<APP_VERSION>-runtime`

Создание тега в таком формате, создаст pipeline с набором задач для деплоймента сервисов. `APP_VERSION` это версия Chart.yaml `appVersion`.

Например:
* [2.3.2-runtime-helm2](https://gitlab.wnb:28443/cexiopay/devops/kubernetes-deployment/-/commits/2.3.2-runtime-helm2)
* [2.3.2-runtime](https://gitlab.wnb:28443/cexiopay/devops/kubernetes-deployment/-/tags/2.3.2-runtime)
* etc

NOTE! Перед созданием тега, вы должны убедиться, что релизные контейнеры сервисов выложены в репозитории контейнеров.

NOTE! Во время переходной фазы на `Helm 3` остаются возможность создать наборы задач под `Helm 2`. Для этого используйте суффикс `<APP_VERSION>-runtime-helm2`.

#### Zero downtime deployment (Blue/Green)

Для обеспечения **zero downtime deployment** стратегии, мы используем подход приближенный к [Canary](https://martinfowler.com/bliki/CanaryRelease.html). Деплой `runtime` chart выполняется с именами Helm релизов `Blue` и `Green`.

* `Blue` - это основной инстанс обрабатывающий нагрузку
* `Green` - это дополнительный инстанс который создается во время нового релиза (живет короткое время)

![zero-downtime-deployment-strategy.png](./README.files/zero-downtime-deployment-strategy.png)

Условно, стратегия сводится к следующим шагам:

1. Имеем работающую сборку `runtime vX.X.X` задеплоен под Helm релизом `Blue`. Helm релиза `Green` нет в кластере (имеем только `Blue`)
1. Подготовили новую сборку `runtime vY.Y.Y` и выполняем деплой под Helm релизом `Green`. В этот период времени доступно следующее:
	* Продуктивный трафик продолжает направляться ТОЛЬКО на Helm релиз `Blue`
	* К Helm релизу `Green` есть подключение через внутренний домен `***-green-cexiopay.prodcryptopay.kube`(PROD) для проведения [Smoke testing](https://en.wikipedia.org/wiki/Smoke_testing_(software)) по новой функциональности.
	* Если в процессе тестирования обнаружены деффекты, Helm релиз `Green` удаляется и команда работает над исправлением деффектов. ТУТ КОНЕЦ (итого имеем состояние как на шаге 1).
1. Переключаем продуктивный трафик (возможно постепенно 10%, 25%, 50%, 100%) на использование Helm релиза `Green`
1. Ожидаем завершения всех фоновых задач процессинга на Helm релизе `Blue`
1. Выполняем деплой сборки `runtime vY.Y.Y` под Helm релизом `Blue`
1. Переключаем продуктивный трафик (возможно постепенно 10%, 25%, 50%, 100%) на использование Helm релиза `Blue`
1. Ожидаем завершения всех фоновых задач процессинга на Helm релизе `Green`
1. Удаляем Helm релиз `Green`. ТУТ КОНЕЦ (итого имеем состояние как на шаге 1).


### Database Releases

Tag name format: `<RELEASE_TAG>-database`

1. Вносим коректные версии в файл [migration/MANIFEST](./migration/MANIFEST)
1. Создаем тег в таком формате, создаст pipeline с набором задач для деплоймента базы версии `RELEASE_TAG`.
	Например:
	* [20210622-00-database](https://gitlab.wnb:28443/cexiopay/devops/kubernetes-deployment/-/tags/20210622-00-database)
	* [20210622-01-database](https://gitlab.wnb:28443/cexiopay/devops/kubernetes-deployment/-/tags/20210622-01-database)
	* etc
	NOTE! Перед созданием тега, вы должны убедиться, что [релизные контейнеры](https://gitlab.wnb:28443/cexiopay/database/pipelines) с версией [`DATABASE_IMAGE_TAG`](https://gitlab.wnb:28443/cexiopay/database/-/tags) выложены в репозитории контейнеров.

## HELM Notes

### Get started
1. Make configuration file for `kubectl` application (setup ~/.kube/config)
1. Set alias to HELM
	```bash
	$ cd_cexiopay
	$ cd devops.kubernetes-deployment/runtime/
	# Set "helm" docker alias if you does not have Helm locally. Choose one of following:
	$ alias helm="docker run --interactive --tty --rm --volume \"${HOME}/.kube/config:/root/.kube/config\" --volume \"$(pwd):/apps\" --entrypoint /usr/bin/helm devdocker.infra.kube/cexiolabs/docker/helm3/snapshot:master.dcb37861"
	$ alias helm="docker run --interactive --tty --rm --volume \"${HOME}/.kube/config:/root/.kube/config\" --volume \"$(pwd):/apps\" alpine/helm:3.2.0"
	```
1. Set environment
	```bash
	$ export ENV=evolution
	$ export ENV=presentation
	$ export ENV=test
	```

```shell
export RUNTIME_RELEASE=blue
rm -rf tmp
mkdir tmp
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json ConfigMap/cpservice                 | jq -r ".data" | yq eval -P  > tmp/configmap-cpservice.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json ConfigMap/messengerbridge-files     | jq -r ".data" | yq eval -P  > tmp/configmap-messengerbridge-files.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json ConfigMap/processing-envvars-setup  | jq -r ".data" | yq eval -P  > tmp/configmap-processing-envvars-setup.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json ConfigMap/processing-envvars        | jq -r ".data" | yq eval -P  > tmp/configmap-processing-envvars.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json ConfigMap/processing-files          | jq -r ".data" | yq eval -P  > tmp/configmap-processing-files.yaml

kubectl --namespace "cexiopay-${ENV}-admin" get --output=json Secrets/api                         | jq -r ".data" | yq eval -P  > tmp/secret-api.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json Secrets/identity                    | jq -r ".data" | yq eval -P  > tmp/secret-identity.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json Secrets/messengerbridge             | jq -r ".data" | yq eval -P  > tmp/secret-messengerbridge.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json Secrets/notifier                    | jq -r ".data" | yq eval -P  > tmp/secret-notifier.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json Secrets/processing                  | jq -r ".data" | yq eval -P  > tmp/secret-processing.yaml
kubectl --namespace "cexiopay-${ENV}-admin" get --output=json Secrets/processing-setup            | jq -r ".data" | yq eval -P  > tmp/secret-processing-setup.yaml
```

### Useful commands
See full doc https://v3.helm.sh/docs/helm

#### List
```bash
$ helm --namespace "cexiopay-${ENV}" list --all
NAME             	REVISION	UPDATED                 	STATUS  	CHART                  	APP VERSION	NAMESPACE
???
```

#### Delete the release from Kubernetes
Full delete `tag` for example
```bash
$ helm --namespace "cexiopay-${ENV}" uninstall blue
```

#### Deploy the chart into cluster
```bash
$ helm --namespace "cexiopay-${ENV}" upgrade --install --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" blue .
```

```bash
$ helm --namespace "cexiopay-${ENV}" upgrade --install --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" --set "application.processing.serviceImage=devdocker.infra.kube/cexiopay/cpservice/snapshot" --set "application.processing.tag=2-1-38-hotfix" blue .
```

```bash
$ helm --namespace "cexiopay-${ENV}" upgrade --install --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" --set "application.processing.tag=master" --set "application.api.tag=master" blue .
```


## Kubectl Notes

### Get started
1. Make configuration file for `kubectl` application (setup ~/.kube/config)

### Backup all secrets

```bash
kubectl --namespace=cexiopay-infra get --output=yaml secrets | tee "runtime.secrets/backup$(date '+%Y%m%d%H%M%S')-cexiopay-infra-secrets.yaml"
kubectl --namespace=cexiopay-evolution get --output=yaml secrets | tee "runtime.secrets/backup$(date '+%Y%m%d%H%M%S')-cexiopay-evolution-secrets.yaml"
kubectl --namespace=cexiopay-presentation get --output=yaml secrets | tee "runtime.secrets/backup$(date '+%Y%m%d%H%M%S')-cexiopay-presentation-secrets.yaml"
kubectl --namespace=cexiopay-test get --output=yaml secrets | tee "runtime.secrets/backup$(date '+%Y%m%d%H%M%S')-cexiopay-test-secrets.yaml"
```

### Backup all configMaps

```bash
kubectl --namespace=cexiopay-infra get --output=yaml configmaps | tee "runtime.configmaps/backup$(date '+%Y%m%d%H%M%S')-cexiopay-infra-configmaps.yaml"
kubectl --namespace=cexiopay-evolution get --output=yaml configmaps | tee "runtime.configmaps/backup$(date '+%Y%m%d%H%M%S')-cexiopay-evolution-configmaps.yaml"
kubectl --namespace=cexiopay-presentation get --output=yaml configmaps | tee "runtime.configmaps/backup$(date '+%Y%m%d%H%M%S')-cexiopay-presentation-configmaps.yaml"
kubectl --namespace=cexiopay-test get --output=yaml configmaps | tee "runtime.configmaps/backup$(date '+%Y%m%d%H%M%S')-cexiopay-test-configmaps.yaml"
```
