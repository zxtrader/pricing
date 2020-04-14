# DevOps

## Database Install/Rollback

Start pipeline with following variable:
# Cryptopay's Kubernetes Deployment

## Именование тегов

### Database Releases

Tag name format: `DB-<DB_VERSION>`

Создание тега в таком формает, создаст pipeline с набором задач для деплоймента базы версии `DB_VERSION`.
Например:
* [DB-v02.00](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.00)
* [DB-v02.01](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.01)
* [DB-v02.02](https://gitlab.wnb:28443/cryptopay/devops/kubernetes-deployment/-/tags/DB-v02.02)
* etc

NOTE! Перед созданием тега, вы должны убедится, что [релизные контейнеры](https://gitlab.wnb:28443/cryptopay/database/pipelines) с версией [`DB_VERSION`](https://gitlab.wnb:28443/cryptopay/database/-/tags) выложены в репозитории контейнеров (прод контейнер в продовский репозиторий)