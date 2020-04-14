#!/bin/sh
#

# Exit on first fail
set -e

if [ $# -eq 0 ]; then
	echo
	echo "	Usage example:"
	echo
	echo "		$0 [--kube-context=evolution] --image=devdocker.infra.kube/cryptopay/database-preproduction --tag=vXX.YY <--install|--rollback>"
	echo
	exit 1
fi

# Check args
while [ "$1" != "" ]; do
	case "$1" in
		--kube-context=*)
			ARG_KUBE_CONTEXT=$(echo "$1" | cut -d= -f2)
			;;
		--image=*)
			ARG_IMAGE=$(echo "$1" | cut -d= -f2)
			;;
		--tag=*)
			ARG_TAG=$(echo "$1" | cut -d= -f2)
			;;
		--install)
			ARG_ACTION=install
			;;
		--rollback)
			ARG_ACTION=rollback
			;;
		*)
			echo "Unexpected parameter $1" >&2
			exit 42
			;;
	esac
	shift
done

validateArg() {
	local ARG=$1
	local PARAM=$2
	if [ -z "$ARG" ]; then
		echo >&2
		echo "	[!] Failure. Argument $PARAM was not provided" >&2
		echo >&2
		exit -127
	fi
}

validateArg "$ARG_IMAGE" "--image"
validateArg "$ARG_TAG" "--tag"
validateArg "$ARG_ACTION" "--install|--rollback"


ARG_TIMESTAMP="$(date '+%Y%m%d%H%M%S')"

# Normalize SCRIPT_DIR
SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}"
SCRIPT_DIR=$(pwd -LP)
cd - > /dev/null

TEMP_FILE=$(mktemp)
#kubectl delete 

cat "${SCRIPT_DIR}/migration-job-template.yaml" | sed "s!ARG_IMAGE!${ARG_IMAGE}!g" | sed "s!ARG_ACTION!${ARG_ACTION}!g" | sed "s!ARG_TAG!${ARG_TAG}!g" | sed "s!ARG_TIMESTAMP!${ARG_TIMESTAMP}!g" > "${TEMP_FILE}"

echo
echo "# Job definition YAML"
cat "${TEMP_FILE}"


KUBE_OPTS=""
[ -n "${ARG_KUBE_CONTEXT}" ] && KUBE_OPTS="${KUBE_OPTS} --context ${ARG_KUBE_CONTEXT}"

IS_EXIST_PREV_JOB=$(kubectl ${KUBE_OPTS} get --ignore-not-found jobs migration)
if [ -n "${IS_EXIST_PREV_JOB}" ]; then

	echo
	echo "Job already exists. Wait 10 seconds and remove it."
	sleep 10
	kubectl ${KUBE_OPTS} delete jobs migration

	echo "Job was deleted. Wait 5 seconds to continue."
	sleep 5
fi

echo
echo "# Apply the Job"
exec kubectl ${KUBE_OPTS} apply -f "${TEMP_FILE}"
echo
