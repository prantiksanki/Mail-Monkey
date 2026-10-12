/**
 * Integration tests for the trial-expiry job.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	createPurchase,
	getPurchaseById,
	getUnreadNotificationsByUserId,
} from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";
import { expireDueTrials } from "./expire-trials";
import { TRIAL_CUSTOMER_ID, trialSubscriptionId } from "./trial";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

const PRODUCT_ID = "test-pro-monthly";

maybeDescribe("expireDueTrials — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("expire-trials");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	it("expires a due trial and records a trial_ended notification", async () => {
		const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const purchase = await createPurchase({
			type: "SUBSCRIPTION",
			userId: seed.userId,
			customerId: TRIAL_CUSTOMER_ID,
			subscriptionId: trialSubscriptionId(seed.userId),
			productId: PRODUCT_ID,
			status: "trialing",
			trialEndsAt: yesterday,
		});
		expect(purchase).not.toBeNull();

		const result = await expireDueTrials();
		expect(result.expired).toBeGreaterThanOrEqual(1);

		const updated = await getPurchaseById(purchase?.id ?? "");
		expect(updated?.status).toBe("expired");

		const notifications = await getUnreadNotificationsByUserId(seed.userId);
		expect(notifications.some((n) => n.type === "trial_ended")).toBe(true);
	});

	it("leaves a not-yet-due trial untouched", async () => {
		const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
		const purchase = await createPurchase({
			type: "SUBSCRIPTION",
			userId: seed.otherUserId,
			customerId: TRIAL_CUSTOMER_ID,
			subscriptionId: trialSubscriptionId(seed.otherUserId),
			productId: PRODUCT_ID,
			status: "trialing",
			trialEndsAt: tomorrow,
		});

		expect(purchase).not.toBeNull();

		await expireDueTrials();

		const stillActive = await getPurchaseById(purchase?.id ?? "");
		expect(stillActive?.status).toBe("trialing");
	});
});
