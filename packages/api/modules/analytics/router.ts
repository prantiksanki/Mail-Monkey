import { getEmailVolume } from "./procedures/get-email-volume";
import { getOverview } from "./procedures/get-overview";
import { getTopSenders } from "./procedures/get-top-senders";

export const analyticsRouter = {
	overview: getOverview,
	topSenders: getTopSenders,
	emailVolume: getEmailVolume,
};
