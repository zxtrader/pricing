#!/bin/sh
#

echo
echo "Enter to Price Service Entrypoint..."

case "${1}" in
	"/bin/sh"|"/bin/bash"|shell)
		exec /bin/sh
		;;
	"price")
		echo
		echo "Starting Price Service..."
		exec /usr/local/bin/node /usr/local/org.zxteam.price/bin/price-service.js --config=/etc/org.zxteam.price/price-service.config
		;;
	*)
		echo "Wrong CMD argument: ${1}" >&2
		echo
		echo "Available CMD:"
		echo "	price"
		echo "	/bin/sh"
		echo "	/bin/bash"
		echo "	shell"
		echo
		exit 1
		;;
esac
