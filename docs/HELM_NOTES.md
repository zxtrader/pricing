# HELM Notes

## Get started
1. Make configuration file for `kubectl` application (setup ~/.kube/config)
1. Detect Tiller version (find `tiller-deploy` deployment inside your cluster's namespace and get version from container, something like: harbor.infra.kube/rancherdefaultimg/tiller:v2.14.2)
1. Set alias to HELM version (very same as tiller)
	```bash
	$ cd ~/w-cex/cexiopay/devops.kubernetes-deployment/runtime/
	$ alias helm="docker run --interactive --tty --rm --volume \"${HOME}/.kube/config:/root/.kube/config\" --volume \"$(pwd):/apps\" alpine/helm:2.14.0"
	```
	Note: On Linux host you may need `sudo iptables -t nat -I POSTROUTING 1 -o eth0 -s 172.17.0.1/16 -j SNAT --to-source 10.77.2.147`
1. Set environment
	```bash
	$ export ENV=evolution
	$ export ENV=presentation
	$ export ENV=sandbox
	```

## Useful commands
See full doc https://v2.helm.sh/docs/helm/#helm

### List
```bash
$ helm --tiller-namespace "cexiopay-${ENV}" list --all
NAME             	REVISION	UPDATED                 	STATUS  	CHART                  	APP VERSION	NAMESPACE
cpadmin          	1       	Tue Nov 26 10:25:20 2019	DEPLOYED	cpadmin-1.0.0          	1.0.0      	cexiopay
cpservice        	7       	Mon Feb 17 13:18:08 2020	DEPLOYED	cpservice-1.20.0       	1.20.0     	cexiopay
wtfcryptoprovider	2       	Tue Dec  3 10:14:58 2019	DEPLOYED	wtfcryptoprovider-1.0.0	1.0.0      	cexiopay
```

### History prints historical revisions for a given release
```bash
$ helm history cpservice --max=4
REVISION	UPDATED                 	STATUS    	CHART           	DESCRIPTION     
6       	Wed Nov 27 13:24:22 2019	SUPERSEDED	cpservice-1.20.0	Upgrade complete
7       	Mon Feb 17 13:18:08 2020	DEPLOYED  	cpservice-1.20.0	Upgrade complete
```

### Delete the release from Kubernetes
Full delete `cpservice` for example
```bash
#helm3###$ helm uninstall --namespace "cexiopay-${ENV}" tag
#helm2###$ helm --tiller-namespace "cexiopay-${ENV}" delete --purge tag
```

### Deploy the service into cluster
```bash
#helm3###$ helm upgrade --install --namespace "cexiopay-${ENV}" --history-max 3 --values "values-base.yaml" --values "values.${ENV}.yaml" tag .
#helm2###$ helm --tiller-namespace "cexiopay-${ENV}" upgrade --install --namespace "cexiopay-${ENV}" --values "values-base.yaml" --values "values.${ENV}.yaml" tag .
```

```bash
$ helm --tiller-namespace "cexiopay-${ENV}" upgrade --install --namespace "cexiopay-${ENV}" --values "values-base.yaml" --values "values.${ENV}.yaml" blue .
```

```bash
$ helm --tiller-namespace "cexiopay-${ENV}" upgrade --install --namespace "cexiopay-${ENV}" --values "values-base.yaml" --values "values.${ENV}.yaml" --set "application.processing.tag=master" --set "application.dashboard.tag=master" blue .
```
