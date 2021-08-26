#!/bin/sh
#

# Exit on first fail
set -e


if [ $# -ne 1 ]; then
	echo
	echo "	Usage example:"
	echo
	echo "		$0 <KUBE NAMESPACE>"
	echo
	exit 1
fi

KUBE_NAMESPACE="$1"

# Normalize SCRIPT_DIR
SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}"
SCRIPT_DIR=$(pwd -LP)
cd - > /dev/null

PROJECT_DIR=$(dirname "${SCRIPT_DIR}")
TARGET_DIRECTORY="${PROJECT_DIR}/runtime/tmp"

if [ ! -d "${TARGET_DIRECTORY}" ]; then
	mkdir -p "${TARGET_DIRECTORY}"
fi

kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/cpservice                 | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-cpservice.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/gatehostinternal-envvars  | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-gatehostinternal-envvars.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/gatehostinternal-files    | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-gatehostinternal-files.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/messengerbridge-files     | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-messengerbridge-files.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/notifier-envvars          | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-notifier-envvars.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/notifier-files            | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-notifier-files.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/processing-envvars-setup  | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-processing-envvars-setup.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/processing-envvars        | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-processing-envvars.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json ConfigMap/processing-files          | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/configmap-processing-files.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/api                         | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-api.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/gatehostinternal            | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-gatehostinternal.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/identity                    | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-identity.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/messengerbridge             | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-messengerbridge.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/notifier                    | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-notifier.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/processing                  | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-processing.yaml"
kubectl --namespace "${KUBE_NAMESPACE}" get --output=json Secrets/processing-setup            | jq -r ".data" | yq eval -P  > "${TARGET_DIRECTORY}/secret-processing-setup.yaml"
