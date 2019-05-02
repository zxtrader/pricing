import * as express from "express";

import v1 from "./v1";
import { PriceService } from "..";

export default function (priceService: PriceService) {
	const expressRouter: express.Router = express.Router();

	expressRouter.use("/v1", v1(priceService));

	return expressRouter;
}
