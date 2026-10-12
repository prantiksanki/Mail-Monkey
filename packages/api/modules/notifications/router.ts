import { listNotifications } from "./procedures/list-notifications";
import { markRead } from "./procedures/mark-read";

export const notificationsRouter = {
	listNotifications,
	markRead,
};
