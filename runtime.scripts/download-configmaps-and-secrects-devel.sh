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

download "ConfigMap/gateintegrationdemo-files"         "${TARGET_DIRECTORY}/configmap-gateintegrationdemo-files.yaml"
