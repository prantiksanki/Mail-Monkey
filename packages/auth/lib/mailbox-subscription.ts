import { getMailboxesByUserId, getPurchasesByUserId } from "@repo/database";
import { logger } from "@repo/logs";
import { setSubscriptionSeats } from "@repo/payments";

/**
 * Update the subscription seats for a user when their mailbox count changes.
 * This implements the "mailbox-as-seat" pricing model where each connected mailbox
 * counts as a seat and scales the subscription price.
 *
 * @param userId - The user ID whose subscription should be updated
 */
export async function updateMailboxCountInUserSubscription(userId: string) {
	// Get user's active subscriptions
	const purchases = await getPurchasesByUserId(userId);

	if (!purchases || purchases.length === 0) {
		return; // No subscriptions to update
	}

	// Find the active subscription
	const activeSubscription = purchases.find(
		(purchase) =>
			purchase.type === "SUBSCRIPTION" && purchase.subscriptionId,
	);

	if (!activeSubscription?.subscriptionId) {
		return; // No active subscription to update
	}

	try {
		const mailboxes = await getMailboxesByUserId(userId);
		const seats = Math.max(mailboxes.length, 1);

		await setSubscriptionSeats({
			id: activeSubscription.subscriptionId,
			seats,
		});
		logger.info("Updated user subscription seats", {
			userId,
			subscriptionId: activeSubscription.subscriptionId,
			seats,
		});
	} catch (error) {
		logger.error("Could not update seats in user subscription", {
			userId,
			error,
		});
	}
}
