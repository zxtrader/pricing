#!/bin/bash
#

#ZONES="evolution"
#ZONES="presentation"
ZONES="evolution presentation"
CONFIGMAPS="api-envvars cpservice gatehostinternal-envvars identity-envvars invoice-envvars messengerbridge-files notifier-envvars notifier-files processing-envvars processing-files"
SECRETS="api gatehostinternal identity invoice messengerbridge migration notifier processing"

# Normalize SCRIPT_DIR
SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}"
SCRIPT_DIR=$(pwd -LP)
cd - > /dev/null

set -e

for ZONE in ${ZONES}; do
	RELATIVE_CONFIGMAPS_DIRECTORY="runtime.configmaps/${ZONE}"
	FULL_CONFIGMAPS_DIRECTORY="${SCRIPT_DIR}/${RELATIVE_CONFIGMAPS_DIRECTORY}"
	if [ ! -d "${FULL_CONFIGMAPS_DIRECTORY}" ]; then
		echo "Creating ${RELATIVE_CONFIGMAPS_DIRECTORY} directory ..."
		mkdir -p "${FULL_CONFIGMAPS_DIRECTORY}"
	fi

	RELATIVE_SECRETS_DIRECTORY="runtime.secrets/${ZONE}"
	FULL_SECRETS_DIRECTORY="${SCRIPT_DIR}/${RELATIVE_SECRETS_DIRECTORY}"
	if [ ! -d "${FULL_SECRETS_DIRECTORY}" ]; then
		echo "Creating ${RELATIVE_SECRETS_DIRECTORY} directory ..."
		mkdir -p "${FULL_SECRETS_DIRECTORY}"
	fi


	
	for CONFIGMAP in ${CONFIGMAPS}; do
		RELATIVE_CONFIGMAP_FILE="${RELATIVE_CONFIGMAPS_DIRECTORY}/${CONFIGMAP}.yaml"
		FULL_CONFIGMAP_FILE="${SCRIPT_DIR}/${RELATIVE_CONFIGMAP_FILE}"
		echo "Syncing ${RELATIVE_CONFIGMAP_FILE} ..."
		cat <<EOF > "${FULL_CONFIGMAP_FILE}"
# kubectl --namespace cexpay-${ZONE}-admin get --output=yaml ConfigMap/${CONFIGMAP}
# kubectl --namespace cexpay-${ZONE}-admin get --output=json ConfigMap/${CONFIGMAP} | jq -r ".data" | yq eval -P | sed 's/^/  /'
# kubectl --namespace cexpay-${ZONE}-admin apply --filename=runtime.configmaps/${ZONE}/${CONFIGMAP}.yaml

apiVersion: v1
kind: ConfigMap
metadata:
  name: ${CONFIGMAP}
  namespace: cexpay-${ZONE}-admin
data:
EOF
	kubectl --namespace cexpay-${ZONE}-admin get --output=json ConfigMap/${CONFIGMAP} | jq -r ".data" | yq eval -P | sed 's/^/  /' >> "${FULL_CONFIGMAP_FILE}"
	done


	for SECRET in ${SECRETS}; do
		RELATIVE_SECRET_FILE="${RELATIVE_SECRETS_DIRECTORY}/${SECRET}.yaml"
		FULL_SECRET_FILE="${SCRIPT_DIR}/${RELATIVE_SECRET_FILE}"
		echo "Syncing ${RELATIVE_SECRET_FILE} ..."
		cat <<EOF > "${FULL_SECRET_FILE}"
# kubectl --namespace cexpay-${ZONE}-admin get --output=yaml Secrets/${SECRET}
# kubectl --namespace cexpay-${ZONE}-admin get --output=json Secrets/${SECRET} | jq -r ".data" | yq eval -P | sed 's/^/  /'
# kubectl --namespace cexpay-${ZONE}-admin apply --filename=runtime.secrets/${ZONE}/${SECRET}.yaml

apiVersion: v1
kind: Secret
metadata:
  name: ${SECRET}
  namespace: cexpay-${ZONE}-admin
type: Opaque
data:
EOF
	kubectl --namespace cexpay-${ZONE}-admin get --output=json Secrets/${SECRET} | jq -r ".data" | yq eval -P | sed 's/^/  /' >> "${FULL_SECRET_FILE}"
	done
done
