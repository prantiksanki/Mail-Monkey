/**
 * Integration tests for the start-trial building blocks: creating the synthetic
 * trial purchase makes the user resolve to the Starter plan, and the one-trial-
 * per-user guard query finds an existing (even expired) trial.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import { createPurchase, getTrialPurchaseByUserId } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";
import { resolveUserPlan } from "./resolve-plan";
import { TRIAL_CUSTOMER_ID, trialSubscriptionId } from "./trial";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

// Must match a configured Starter price so createPurchasesHelper resolves to "starter".
const STARTER_PRODUCT_ID = process.env.NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY;

maybeDescribe("start-trial building blocks — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("start-trial");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	it("a fresh user resolves to the free plan", async () => {
		const plan = await resolveUserPlan(seed.userId);
		expect(plan).toBe("free");
	});

	it("a trialing purchase resolves the user to the Starter plan", async () => {
		if (!STARTER_PRODUCT_ID) {
			// Without a configured price id, the trial can't map to Starter; skip.
			return;
		}

		const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
		await createPurchase({
			type: "SUBSCRIPTION",
			userId: seed.userId,
			customerId: TRIAL_CUSTOMER_ID,
			subscriptionId: trialSubscriptionId(seed.userId),
			productId: STARTER_PRODUCT_ID,
			status: "trialing",
			trialEndsAt,
		});

		const plan = await resolveUserPlan(seed.userId);
		expect(plan).toBe("starter");
	});

	it("getTrialPurchaseByUserId finds the existing trial (one-per-user guard)", async () => {
		const existing = await getTrialPurchaseByUserId(seed.userId);
		expect(existing).not.toBeNull();
		expect(existing?.customerId).toBe(TRIAL_CUSTOMER_ID);
	});

	it("a user with no trial has no trial purchase", async () => {
		const none = await getTrialPurchaseByUserId(seed.otherUserId);
		expect(none).toBeNull();
	});
});
