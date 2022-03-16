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

download () {
	kubectl --namespace "${KUBE_NAMESPACE}" get --output=json $1 | jq -r ".data" | yq eval -P  > "$2"
	FILE_SIZE=$(cat "$2" | wc -c | tr -d " ")
	# Convert string value in FILE_SIZE to integer
	FILE_SIZE=$(($FILE_SIZE + 0))

	if [ ${FILE_SIZE} -le 1 ]; then
		echo "Downloaded '$1' ${FILE_SIZE} bytes, check that '$1' exist in '${KUBE_NAMESPACE}' enviroment"
		exit 42
	fi
	echo "Downloaded '$1' $FILE_SIZE bytes"
}

download "ConfigMap/api-envvars"                       "${TARGET_DIRECTORY}/configmap-api-envvars.yaml"
download "ConfigMap/cpservice"                         "${TARGET_DIRECTORY}/configmap-cpservice.yaml"
download "ConfigMap/gatehostinternal-envvars"          "${TARGET_DIRECTORY}/configmap-gatehostinternal-envvars.yaml"
# download "ConfigMap/ptinvoice-envvars"                 "${TARGET_DIRECTORY}/configmap-ptinvoice-envvars.yaml"
# download "ConfigMap/ptmerchant-envvars"                "${TARGET_DIRECTORY}/configmap-ptmerchant-envvars.yaml"
# download "ConfigMap/ptservice-envvars"                 "${TARGET_DIRECTORY}/configmap-ptservice-envvars.yaml"
download "ConfigMap/identity-envvars"                  "${TARGET_DIRECTORY}/configmap-identity-envvars.yaml"
download "ConfigMap/messengerbridge-files"             "${TARGET_DIRECTORY}/configmap-messengerbridge-files.yaml"
download "ConfigMap/notifier-envvars"                  "${TARGET_DIRECTORY}/configmap-notifier-envvars.yaml"
download "ConfigMap/notifier-files"                    "${TARGET_DIRECTORY}/configmap-notifier-files.yaml"
download "ConfigMap/processing-envvars"                "${TARGET_DIRECTORY}/configmap-processing-envvars.yaml"
download "ConfigMap/processing-files"                  "${TARGET_DIRECTORY}/configmap-processing-files.yaml"
download "Secrets/api"                                 "${TARGET_DIRECTORY}/secret-api.yaml"
download "Secrets/gatehostinternal"                    "${TARGET_DIRECTORY}/secret-gatehostinternal.yaml"
# download "Secrets/ptinvoice"                           "${TARGET_DIRECTORY}/secret-ptinvoice.yaml"
# download "Secrets/ptmerchant"                          "${TARGET_DIRECTORY}/secret-ptmerchant.yaml"
# download "Secrets/ptservice"                           "${TARGET_DIRECTORY}/secret-ptservice.yaml"
download "Secrets/identity"                            "${TARGET_DIRECTORY}/secret-identity.yaml"
download "Secrets/invoice"                             "${TARGET_DIRECTORY}/secret-invoice.yaml"
download "Secrets/messengerbridge"                     "${TARGET_DIRECTORY}/secret-messengerbridge.yaml"
download "Secrets/notifier"                            "${TARGET_DIRECTORY}/secret-notifier.yaml"
download "Secrets/processing"                          "${TARGET_DIRECTORY}/secret-processing.yaml"

case "${KUBE_NAMESPACE}" in
	cexpay-test-admin|cexpay-admin)
		# Support bot should be presented only in test and producction zones
		download "ConfigMap/supportbot-envvars"                "${TARGET_DIRECTORY}/configmap-supportbot-envvars.yaml"
		download "ConfigMap/supportbot-files"                  "${TARGET_DIRECTORY}/configmap-supportbot-files.yaml"
		download "Secrets/supportbot"                          "${TARGET_DIRECTORY}/secret-supportbot.yaml"
		;;
esac

case "${KUBE_NAMESPACE}" in
	cexpay-evolution-admin|cexpay-presentation-admin|cexpay-test-admin)
		# Support bot should be presented only in evolution, presentation and test zones
		download "ConfigMap/gateintegrationdemo-files"         "${TARGET_DIRECTORY}/configmap-gateintegrationdemo-files.yaml"
		;;
esac

