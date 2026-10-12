import { getAttachment } from "./procedures/get-attachment";
import { getCard } from "./procedures/get-card";
import { listCards } from "./procedures/list-cards";
import { updateCardStatus } from "./procedures/update-card-status";

export const paymentTrackingRouter = {
	cards: {
		list: listCards,
		get: getCard,
		updateStatus: updateCardStatus,
		getAttachment,
	},
};
