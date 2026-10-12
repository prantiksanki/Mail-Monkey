import { config } from "@repo/payments/config";

/** Length of the card-free Pro trial, in days. */
export const TRIAL_PERIOD_DAYS = 7;

/** Sentinel customerId used to mark synthetic (non-provider) trial purchases. */
export const TRIAL_CUSTOMER_ID = "trial";

/** Deterministic subscriptionId for a user's trial (unique, one per user). */
export function trialSubscriptionId(userId: string) {
	return `trial_${userId}`;
}

/**
 * The Starter monthly price the trial maps to. The synthetic purchase must
 * carry this productId so `createPurchasesHelper` resolves the user to the
 * Starter plan.
 */
export function getStarterMonthlyProductId(): string | undefined {
	const starter = config.plans.starter;
	if (!("prices" in starter)) {
		return undefined;
	}
	const monthly = starter.prices.find(
		(price) => "interval" in price && price.interval === "month",
	);
	return monthly?.productId;
}
