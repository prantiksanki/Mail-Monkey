import { getPurchasesByUserId } from "@repo/database";
import type { PlanId } from "@repo/payments/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";

/**
 * Resolve the active plan for a user based on their purchases.
 * @param userId - The user ID
 * @returns The active plan ID (e.g., "free", "pro", "premium")
 */
export async function resolveUserPlan(userId: string): Promise<PlanId> {
	const purchases = await getPurchasesByUserId(userId);
	const { activePlan } = createPurchasesHelper(purchases);

	// If no active plan, default to free
	return (activePlan?.id ?? "free") as PlanId;
}
