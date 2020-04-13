# Migration

Migration - это [Kubernetes Job](https://kubernetes.io/docs/concepts/workloads/controllers/jobs-run-to-completion/) который выполняет миграцию базы данных.

Разрабочики поставляют обновления базы данных в виде self-execute контейнера, которому нужны лишь креденшелы к базе данных.
Bash скрипт `migration-exec.sh` всего лишь запускает контейнер, предоставленный разработчиками к релизу, в виде `Kubernetes Job`-ы

## Usage

Для запуска (перезапуска) джоба в кубе, просто запустить shell скрипт

```bash
$ ./migration-exec.sh 
```
