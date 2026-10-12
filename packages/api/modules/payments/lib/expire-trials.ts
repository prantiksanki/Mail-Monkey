import {
	createNotification,
	getExpiredDueTrials,
	updatePurchase,
} from "@repo/database";
import { logger } from "@repo/logs";

/**
 * Downgrade any trials whose 7-day period has elapsed back to the free plan by
 * flipping their synthetic purchase to `expired` (which makes
 * `createPurchasesHelper` stop resolving the user to Pro), and record a
 * `trial_ended` notification so the user is told in-app.
 */
export async function expireDueTrials(now: Date = new Date()) {
	const due = await getExpiredDueTrials(now);

	let expired = 0;
	for (const purchase of due) {
		if (!purchase.userId) {
			continue;
		}

		try {
			await updatePurchase({ id: purchase.id, status: "expired" });
			await createNotification({
				userId: purchase.userId,
				type: "trial_ended",
				title: "Your Pro trial has ended",
				body: "Your 7-day free trial of Pro has ended and your account is back on the Free plan. Upgrade any time to keep Pro features.",
			});
			expired++;
		} catch (error) {
			logger.error("Failed to expire trial", {
				purchaseId: purchase.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { expired };
}
