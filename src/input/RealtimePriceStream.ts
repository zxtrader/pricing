import { Financial, SubscriberChannel } from "@zxteam/contract";
import { SubscriberChannelMixin } from "@zxteam/channels";

/**
 * Provider stream channel of Real time prices
 */
export abstract class RealtimePriceStream implements SubscriberChannel<
	RealtimePriceStream.Notification, RealtimePriceStream.Event> {
}
export interface RealtimePriceStream extends SubscriberChannelMixin<
	RealtimePriceStream.Notification, RealtimePriceStream.Event> { }
SubscriberChannelMixin.applyMixin(RealtimePriceStream);

export namespace RealtimePriceStream {
	export interface Notification {
		readonly sourceSystem: string;
		readonly date: Date;
		readonly marketCurrency: string;
		readonly tradeCurrency: string;
		readonly price: Financial;
	}
	export interface Event extends SubscriberChannel.Event<Notification> { }
	export type Callback = SubscriberChannel.Callback<Notification>;
}
