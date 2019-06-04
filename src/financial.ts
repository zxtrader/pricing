import * as zxteam from "@zxteam/contract";
import { setup as setupFinancial } from "@zxteam/financial.js";

export const financial = setupFinancial({
	backend: "string",
	decimalSeparator: ".",
	defaultRoundOpts: {
		roundMode: zxteam.Financial.RoundMode.Round,
		fractionalDigits: 8
	}
});

export const ZERO = financial.fromInt(0);
