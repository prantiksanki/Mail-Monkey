import type { PurchaseSchema } from "@repo/database";
import { isStagingEnvironment } from "@repo/utils";
import type { z } from "zod";
import { config } from "../config";

type PlanId = keyof typeof config.plans;
type PurchaseWithoutTimestamps = Omit<
	z.infer<typeof PurchaseSchema>,
	"createdAt" | "updatedAt"
>;

const planEntries = Object.entries(config.plans);

/** Sentinel customerId marking a synthetic, card-free trial purchase. */
const TRIAL_CUSTOMER_ID = "trial";

/**
 * Whether a subscription purchase currently grants its plan. A purchase is only
 * "active" when its status is not terminal (`expired`/`canceled`). For synthetic
 * trials we additionally treat the trial as ended the moment `trialEndsAt`
 * passes, so the user drops back to Free immediately — even if the background
 * trial-expiry job hasn't yet flipped the row's status to `expired`.
 */
function isActiveSubscription(
	purchase: PurchaseWithoutTimestamps,
	now: Date,
): boolean {
	if (purchase.status === "expired" || purchase.status === "canceled") {
		return false;
	}

	if (
		purchase.customerId === TRIAL_CUSTOMER_ID &&
		purchase.trialEndsAt &&
		new Date(purchase.trialEndsAt).getTime() <= now.getTime()
	) {
		return false;
	}

	return true;
}

function getActivePlanFromPurchases(purchases?: PurchaseWithoutTimestamps[]) {
	const now = new Date();
	const subscriptionPurchase = purchases?.find(
		(purchase) =>
			purchase.type === "SUBSCRIPTION" &&
			isActiveSubscription(purchase, now),
	);

	if (subscriptionPurchase) {
		const plan = planEntries.find(
			([_, plan]) =>
				"prices" in plan &&
				plan.prices?.some(
					(price) =>
						price.productId === subscriptionPurchase.productId,
				),
		);

		if (!plan) {
			return null;
		}

		const [planId, planDetails] = plan;

		return {
			id: planId as PlanId,
			price:
				"prices" in planDetails
					? planDetails.prices.find(
							(price) =>
								price.productId ===
								subscriptionPurchase.productId,
						)
					: undefined,
			status: subscriptionPurchase.status || "active",
			purchaseId: subscriptionPurchase.id,
		};
	}

	const oneTimePurchase = purchases?.find(
		(purchase) => purchase.type === "ONE_TIME",
	);

	if (oneTimePurchase) {
		const plan = planEntries.find(
			([_, plan]) =>
				"prices" in plan &&
				plan.prices?.some(
					(price) => price.productId === oneTimePurchase.productId,
				),
		);

		if (!plan) {
			return null;
		}

		const [planId, planDetails] = plan;

		return {
			id: planId as PlanId,
			price:
				"prices" in planDetails
					? planDetails.prices.find(
							(price) =>
								price.productId === oneTimePurchase.productId,
						)
					: undefined,
			status: "active",
			purchaseId: oneTimePurchase.id,
		};
	}

	const freePlan = planEntries.find(
		([_, plan]) => "isFree" in plan && plan.isFree,
	);

	return freePlan
		? {
				id: freePlan[0] as PlanId,
				price: undefined,
				status: "active",
			}
		: null;
}

/**
 * Staging has no billing — every user is granted the top paid plan (the last
 * entry in `config.plans`, e.g. "pro") instead of resolving real purchases, so
 * paid features work without a subscription. Real purchase data from staging's
 * own database is ignored entirely in this mode.
 */
function getStagingActivePlan() {
	const [planId, planDetails] = planEntries[planEntries.length - 1];

	return {
		id: planId as PlanId,
		price: "prices" in planDetails ? planDetails.prices?.[0] : undefined,
		status: "active" as const,
		purchaseId: undefined,
	};
}

export function createPurchasesHelper(purchases: PurchaseWithoutTimestamps[]) {
	const activePlan =
		isStagingEnvironment() || config.freeAccess
			? getStagingActivePlan()
			: getActivePlanFromPurchases(purchases);

	const hasSubscription = (planIds?: PlanId[] | PlanId) => {
		return (
			!!activePlan &&
			(Array.isArray(planIds)
				? planIds.includes(activePlan.id)
				: planIds === activePlan.id)
		);
	};

	const hasPurchase = (planId: PlanId) => {
		return !!purchases?.some((purchase) =>
			planEntries.find(([id]) => {
				if (id !== planId) {
					return false;
				}

				const plan = planEntries.find(([id]) => id === planId);
				if (!plan) {
					return false;
				}

				const [_, planDetails] = plan;

				return "prices" in planDetails
					? planDetails.prices?.some(
							(price) => price.productId === purchase.productId,
						)
					: false;
			}),
		);
	};

	return { activePlan, hasSubscription, hasPurchase };
}
