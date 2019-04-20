import { URL } from "url";
import { launcher } from "@zxteam/launcher";
import { loggerFactory } from "@zxteam/logger";

import runtimeFactory from "./index";

const listenHost: string = process.env.HTTP_HOST || "127.0.0.1";
const listenPort: number = Number.parseInt(process.env.HTTP_PORT || "8080");

launcher((configuration: any) => {
	return runtimeFactory({
		storageUrl: helpers.dataStorageUrl(),
		httpOpts: { listenHost, listenPort }
	});
});

namespace helpers {
	export function dataStorageUrl(): URL {
		const { DATASTORAGE_URL } = process.env;
		return new URL(DATASTORAGE_URL || "redis://localhost:6379");
	}
}
