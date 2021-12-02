#!/bin/sh
#

# Exit on first fail
set -e

int() { printf '%d' ${1:-} 2>/dev/null || :; }

if [ $# -eq 0 ]; then
	echo
	echo "	Usage example:"
	echo
	echo "		$0 --kube-context=evolution --kube-namespace=cexpay-evolution --kube-admin-namespace=cexpay-evolution-admin --image=docker-cexpay.infra.kube/cexpay/database-evolution --tag=vXX.YY [--target-version=v42] <--install|--rollback>"
	echo
	exit 1
fi

# Check args
while [ "$1" != "" ]; do
	case "$1" in
		--kube-context=*)
			ARG_KUBE_CONTEXT=$(echo "$1" | cut -d= -f2)
			;;
		--kube-namespace=*)
			ARG_KUBE_NAMESPACE=$(echo "$1" | cut -d= -f2)
			;;
		--kube-admin-namespace=*)
			ARG_KUBE_ADMIN_NAMESPACE=$(echo "$1" | cut -d= -f2)
			;;
		--image=*)
			ARG_IMAGE=$(echo "$1" | cut -d= -f2)
			;;
		--tag=*)
			ARG_TAG=$(echo "$1" | cut -d= -f2)
			;;
		--target-version=*)
			ARG_TARGET_VERSION=$(echo "$1" | cut -d= -f2)
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
validateArg "$ARG_KUBE_CONTEXT" "--kube-context"
validateArg "$ARG_KUBE_NAMESPACE" "--kube-namespace"
validateArg "$ARG_KUBE_ADMIN_NAMESPACE" "--kube-admin-namespace"


ARG_TIMESTAMP="$(date '+%Y%m%d%H%M%S')"

[ -z "${ARG_TARGET_VERSION}" ] && ARG_TARGET_VERSION="${ARG_TAG}"


# Normalize SCRIPT_DIR
SCRIPT_DIR=$(dirname "$0")
cd "${SCRIPT_DIR}"
SCRIPT_DIR=$(pwd -LP)
cd - > /dev/null

JOB_NAME="migration-${ARG_TIMESTAMP}-${ARG_ACTION}"

TEMP_FILE=$(mktemp)

cat "${SCRIPT_DIR}/migration-job-template.yaml" \
	| sed "s!ARG_JOB_NAME!${JOB_NAME}!g" \
	| sed "s!ARG_IMAGE!${ARG_IMAGE}!g" \
	| sed "s!ARG_ACTION!${ARG_ACTION}!g" \
	| sed "s!ARG_TAG!${ARG_TAG}!g" \
	| sed "s!ARG_TIMESTAMP!${ARG_TIMESTAMP}!g" \
	| sed "s!ARG_TARGET_VERSION!${ARG_TARGET_VERSION}!g" \
	| sed "s!ARG_KUBE_NAMESPACE!${ARG_KUBE_NAMESPACE}!g" > "${TEMP_FILE}"

echo
echo "# Job definition YAML"
cat "${TEMP_FILE}"

KUBE_OPTS="--namespace ${ARG_KUBE_NAMESPACE} --context ${ARG_KUBE_CONTEXT}"
KUBE_ADMIN_OPTS="--namespace ${ARG_KUBE_ADMIN_NAMESPACE} --context ${ARG_KUBE_CONTEXT}"

echo "# KUBE_OPTS is: ${KUBE_OPTS}"

kubectl ${KUBE_ADMIN_OPTS} get --output=json Secrets/migration   | jq -r "{ apiVersion: .apiVersion, kind: .kind, metadata: { name: \"${ARG_TIMESTAMP}-migration\" }, data: .data }" | kubectl ${KUBE_OPTS} apply --filename=-

echo "# Checking ${JOB_NAME} for existence..."
IS_EXIST_PREV_JOB=$(kubectl ${KUBE_OPTS} get --ignore-not-found jobs "${JOB_NAME}")
if [ -n "${IS_EXIST_PREV_JOB}" ]; then

	echo
	echo "Job '${JOB_NAME}' already exists. Cannot continue." >&2
	exit 77
fi

echo
echo "# Apply the Job"
kubectl ${KUBE_OPTS} apply -f "${TEMP_FILE}"
sleep 3
echo "# Awaiting for the job completition"
set +e
kubectl ${KUBE_OPTS} wait --for=condition=complete --timeout=300s "job/${JOB_NAME}"
APPLY_JOB_EXIT_CODE=$?
sleep 3
echo "# Job log"
kubectl ${KUBE_OPTS} logs "job/${JOB_NAME}"

if [ ${APPLY_JOB_EXIT_CODE} -ne 0 ]; then
	echo "# Failure Apply Job" >&2
	exit ${APPLY_JOB_EXIT_CODE}
fi

set -e
echo "# Cleanuping oldest jobs..."

if [ "$(uname)" = "Darwin" ]; then
	#  Mac OS X platform
	OBSOLEBE_TIMESTAMP=$(date -u -v-3m '+%Y%m%d%H%M%S')
elif [ "$(readlink /bin/date)" = "/bin/busybox" ]; then
	# 60 seconds * 60 minutes * 24 hours * 90 days
	OBSOLEBE_TIMESTAMP=$(date -d "$(( `date +%s`-60*60*24*90 ))" '+%Y%m%d%H%M%S')
else
	OBSOLEBE_TIMESTAMP=$(date -d "3 month ago" '+%Y%m%d%H%M%S')
fi

set -x

for EXIST_JOB in $(kubectl ${KUBE_OPTS} get jobs -o go-template --template='{{range .items}}{{.metadata.name}} {{end}}'); do
	EXIST_JOB_PREFIX=$(echo "${EXIST_JOB}" | cut -d- -f1)
	EXIST_JOB_TIMESTAMP=$(int $(echo "${EXIST_JOB}" | cut -d- -f2))
	EXIST_JOB_ACTION=$(echo "${EXIST_JOB}" | cut -d- -f3)
	if [ "${EXIST_JOB_PREFIX}" = "migration" ]; then
		if [ "${EXIST_JOB_ACTION}" = "install" -o "${EXIST_JOB_ACTION}" = "rollback" ]; then
			if [ ${EXIST_JOB_TIMESTAMP} -le ${OBSOLEBE_TIMESTAMP} ]; then
				echo "	Deleting obsolete job '${EXIST_JOB}' ..."
				kubectl ${KUBE_OPTS} delete jobs "${EXIST_JOB}"
				sleep 1
			fi
		fi
	fi
	unset EXIST_JOB_PREFIX
	unset EXIST_JOB_TIMESTAMP
	unset EXIST_JOB_ACTION
done
unset EXIST_JOB
unset OBSOLEBE_TIMESTAMP
