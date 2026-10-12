/**
 * Integration tests for the once-per-lifetime `first_summary_viewed` dedup.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import { markFirstSummaryViewed } from "@repo/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestSeed } from "../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../test-helpers/db-seed";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("markFirstSummaryViewed — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("first-summary-viewed");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	it("returns true and stamps the timestamp on the first call", async () => {
		const { db } = await import("@repo/database");

		const fired = await markFirstSummaryViewed(seed.userId);
		expect(fired).toBe(true);

		const user = await db.user.findUnique({
			where: { id: seed.userId },
			select: { firstSummaryViewedAt: true },
		});
		expect(user?.firstSummaryViewedAt).toBeInstanceOf(Date);
	});

	it("returns false on every subsequent call and leaves the timestamp intact", async () => {
		const { db } = await import("@repo/database");
		const before = await db.user.findUnique({
			where: { id: seed.userId },
			select: { firstSummaryViewedAt: true },
		});

		expect(await markFirstSummaryViewed(seed.userId)).toBe(false);
		expect(await markFirstSummaryViewed(seed.userId)).toBe(false);

		const after = await db.user.findUnique({
			where: { id: seed.userId },
			select: { firstSummaryViewedAt: true },
		});
		expect(after?.firstSummaryViewedAt?.getTime()).toBe(
			before?.firstSummaryViewedAt?.getTime(),
		);
	});

	it("is independent per user", async () => {
		expect(await markFirstSummaryViewed(seed.otherUserId)).toBe(true);
		expect(await markFirstSummaryViewed(seed.otherUserId)).toBe(false);
	});
});
