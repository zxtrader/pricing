import { launcher, LaunchError } from "@zxteam/launcher";

import runtimeFactory from "./index";

// const instanceName = process.env.INSTANCE;
// if (instanceName) {
// 	monitorSetup(`PriceService.${instanceName}`);
// } else {
// 	monitorSetup("PriceService");
// }

launcher(async () => null, runtimeFactory);
