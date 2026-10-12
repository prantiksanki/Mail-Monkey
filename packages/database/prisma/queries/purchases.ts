import type { z } from "zod";
import { db } from "../client";
import type { PurchaseSchema } from "../zod";

export async function getPurchaseById(id: string) {
	return db.purchase.findUnique({
		where: { id },
	});
}

export async function getPurchasesByOrganizationId(organizationId: string) {
	return db.purchase.findMany({
		where: {
			organizationId,
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function getPurchasesByUserId(userId: string) {
	return db.purchase.findMany({
		where: {
			userId,
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function getPurchaseBySubscriptionId(subscriptionId: string) {
	return db.purchase.findFirst({
		where: {
			subscriptionId,
		},
	});
}

/**
 * Find the synthetic free-trial purchase for a user, if one exists (even if
 * already expired). Used to enforce one trial per user.
 */
export async function getTrialPurchaseByUserId(userId: string) {
	return db.purchase.findFirst({
		where: {
			userId,
			customerId: "trial",
		},
	});
}

/**
 * Find all trials whose trial period has elapsed and are still active, so the
 * trial-expiry job can downgrade them back to the free plan.
 */
export async function getExpiredDueTrials(now: Date = new Date()) {
	return db.purchase.findMany({
		where: {
			customerId: "trial",
			status: "trialing",
			trialEndsAt: { lte: now },
		},
	});
}

export async function createPurchase(
	purchase: Omit<
		z.infer<typeof PurchaseSchema>,
		"id" | "createdAt" | "updatedAt"
	>,
) {
	const created = await db.purchase.create({
		data: purchase,
	});

	return getPurchaseById(created.id);
}

export async function updatePurchase(
	purchase: Partial<
		Omit<z.infer<typeof PurchaseSchema>, "createdAt" | "updatedAt">
	> & { id: string },
) {
	const updated = await db.purchase.update({
		where: {
			id: purchase.id,
		},
		data: purchase,
	});

	return getPurchaseById(updated.id);
}

export async function deletePurchaseBySubscriptionId(subscriptionId: string) {
	await db.purchase.delete({
		where: {
			subscriptionId,
		},
	});
}
