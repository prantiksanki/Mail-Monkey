// Set the Starter product id BEFORE importing the config/helper modules, since
// `@repo/payments/config` reads it from the environment at module-eval time.
process.env.NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY = "test-starter-monthly";
process.env.NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY = "test-starter-yearly";

import { config } from "@repo/payments/config";
import { createPurchasesHelper } from "@repo/payments/lib/helper";
import { describe, expect, it } from "vitest";

const STARTER_MONTHLY_PRODUCT_ID = (() => {
	const starter = config.plans.starter;
	if (!("prices" in starter)) {
		throw new Error("Test setup: starter plan has no prices");
	}
	const monthly = starter.prices.find(
		(price) => "interval" in price && price.interval === "month",
	);
	if (!monthly) {
		throw new Error("Test setup: starter monthly price not found");
	}
	return monthly.productId;
})();

const HOUR_MS = 60 * 60 * 1000;

/** Build a minimal purchase row (as stored, minus timestamps). */
function purchaseRow(
	overrides: Partial<{
		status: string;
		trialEndsAt: Date | null;
		customerId: string;
	}> = {},
) {
	return {
		id: "purchase_1",
		organizationId: null,
		userId: "user_1",
		type: "SUBSCRIPTION" as const,
		customerId: overrides.customerId ?? "trial",
		subscriptionId: "trial_user_1",
		productId: STARTER_MONTHLY_PRODUCT_ID,
		status: overrides.status ?? "trialing",
		trialEndsAt:
			overrides.trialEndsAt === undefined
				? new Date(Date.now() + 24 * HOUR_MS)
				: overrides.trialEndsAt,
	};
}

describe("createPurchasesHelper — trial expiry resolution", () => {
	it("resolves to Starter while a trial is still within its window", () => {
		const { activePlan } = createPurchasesHelper([
			purchaseRow({ trialEndsAt: new Date(Date.now() + 24 * HOUR_MS) }),
		]);
		expect(activePlan?.id).toBe("starter");
	});

	it("drops to Free once trialEndsAt has passed, even if status is still 'trialing'", () => {
		const { activePlan } = createPurchasesHelper([
			purchaseRow({
				status: "trialing",
				trialEndsAt: new Date(Date.now() - HOUR_MS),
			}),
		]);
		expect(activePlan?.id).toBe("free");
	});

	it("drops to Free when the trial row is already marked 'expired'", () => {
		const { activePlan } = createPurchasesHelper([
			purchaseRow({
				status: "expired",
				trialEndsAt: new Date(Date.now() - HOUR_MS),
			}),
		]);
		expect(activePlan?.id).toBe("free");
	});

	it("drops to Free when a subscription is 'canceled'", () => {
		const { activePlan } = createPurchasesHelper([
			purchaseRow({
				customerId: "cus_real",
				status: "canceled",
				trialEndsAt: null,
			}),
		]);
		expect(activePlan?.id).toBe("free");
	});

	it("keeps a real (non-trial) active subscription on Starter regardless of trialEndsAt", () => {
		const { activePlan } = createPurchasesHelper([
			purchaseRow({
				customerId: "cus_real",
				status: "active",
				// A stale/irrelevant trialEndsAt in the past must NOT affect a
				// real subscription — the window check is trial-only.
				trialEndsAt: new Date(Date.now() - 100 * HOUR_MS),
			}),
		]);
		expect(activePlan?.id).toBe("starter");
	});
});
