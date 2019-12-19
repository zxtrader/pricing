import * as zxteam from "@zxteam/contract";
import { setup as setupFinancial, Settings } from "@zxteam/financial";

export const financial = setupFinancial(
	Settings.Backend.bignumberjs,
	{
		decimalSeparator: ".",
		defaultRoundOpts: {
			roundMode: zxteam.Financial.RoundMode.Round,
			fractionalDigits: 8
		}
	}
);

export const ZERO = financial.fromInt(0);
