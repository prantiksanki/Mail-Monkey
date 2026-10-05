/**
 * Integration tests for rule CRUD procedures.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	createRule,
	deleteRule,
	findRuleByNameInMailbox,
	getRulesByMailboxId,
	toggleRuleEnabled,
} from "@repo/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";
import { verifyMailboxOwnership, verifyRuleOwnership } from "../lib/ownership";

// Skip the entire suite when no DB is available — keeps the unit-test run clean.
const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

const CONDITION = {
	conditionalOperator: "AND" as const,
	aiInstructions: "test rule",
	static: { from: "sender@example.com" },
};
const ACTIONS = [{ type: "ARCHIVE" as const }];

maybeDescribe("rule procedures — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("rules");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	// Clean up rules between tests so list assertions stay predictable
	beforeEach(async () => {
		const { db } = await import("@repo/database");
		await db.rule.deleteMany({ where: { mailboxId: seed.mailboxId } });
	});

	// ── createRule ──────────────────────────────────────────────────────────────

	describe("createRule", () => {
		it("inserts a rule and returns it with the correct fields", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Archive newsletters",
				condition: CONDITION,
				actions: ACTIONS,
			});

			expect(rule.id).toBeTruthy();
			expect(rule.mailboxId).toBe(seed.mailboxId);
			expect(rule.name).toBe("Archive newsletters");
			expect(rule.enabled).toBe(true); // default
			expect(rule.condition).toMatchObject(CONDITION);
			expect(rule.actions).toEqual(ACTIONS);
		});

		it("respects an explicit enabled: false", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Disabled rule",
				condition: CONDITION,
				actions: ACTIONS,
				enabled: false,
			});

			expect(rule.enabled).toBe(false);
		});
	});

	// ── getRulesByMailboxId ──────────────────────────────────────────────────────

	describe("getRulesByMailboxId", () => {
		it("returns an empty array when the mailbox has no rules", async () => {
			const rules = await getRulesByMailboxId({
				mailboxId: seed.mailboxId,
			});
			expect(rules).toEqual([]);
		});

		it("returns all rules for the mailbox ordered newest first", async () => {
			await createRule({
				mailboxId: seed.mailboxId,
				name: "Rule A",
				condition: CONDITION,
				actions: ACTIONS,
			});
			await createRule({
				mailboxId: seed.mailboxId,
				name: "Rule B",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const rules = await getRulesByMailboxId({
				mailboxId: seed.mailboxId,
			});

			expect(rules).toHaveLength(2);
			// Newest first (orderBy createdAt desc)
			expect(rules[0].name).toBe("Rule B");
			expect(rules[1].name).toBe("Rule A");
		});

		it("does not return rules from a different mailbox", async () => {
			await createRule({
				mailboxId: seed.mailboxId,
				name: "My rule",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const rules = await getRulesByMailboxId({
				mailboxId: "non-existent-mailbox-id",
			});
			expect(rules).toEqual([]);
		});
	});

	// ── findRuleByNameInMailbox ──────────────────────────────────────────────────

	describe("findRuleByNameInMailbox", () => {
		it("returns null when no rule with that name exists", async () => {
			const found = await findRuleByNameInMailbox({
				mailboxId: seed.mailboxId,
				name: "Nope",
			});
			expect(found).toBeNull();
		});

		it("matches an existing rule name exactly", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Newsletters",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const found = await findRuleByNameInMailbox({
				mailboxId: seed.mailboxId,
				name: "Newsletters",
			});
			expect(found?.id).toBe(rule.id);
		});

		it("matches case-insensitively", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Finance",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const found = await findRuleByNameInMailbox({
				mailboxId: seed.mailboxId,
				name: "finance",
			});
			expect(found?.id).toBe(rule.id);
		});

		it("matches after trimming surrounding whitespace", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Receipts",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const found = await findRuleByNameInMailbox({
				mailboxId: seed.mailboxId,
				name: "  Receipts  ",
			});
			expect(found?.id).toBe(rule.id);
		});

		it("does not match rules in a different mailbox", async () => {
			await createRule({
				mailboxId: seed.mailboxId,
				name: "Scoped",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const found = await findRuleByNameInMailbox({
				mailboxId: "other-mailbox-id",
				name: "Scoped",
			});
			expect(found).toBeNull();
		});

		it("ignores the excluded rule id (rename of the same rule)", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Keep My Name",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const found = await findRuleByNameInMailbox({
				mailboxId: seed.mailboxId,
				name: "Keep My Name",
				excludeId: rule.id,
			});
			expect(found).toBeNull();
		});

		it("still flags a collision with a different rule when excludeId is set", async () => {
			const ruleA = await createRule({
				mailboxId: seed.mailboxId,
				name: "Shared",
				condition: CONDITION,
				actions: ACTIONS,
			});
			const ruleB = await createRule({
				mailboxId: seed.mailboxId,
				name: "Other",
				condition: CONDITION,
				actions: ACTIONS,
			});

			// Renaming ruleB to "Shared" should collide with ruleA.
			const found = await findRuleByNameInMailbox({
				mailboxId: seed.mailboxId,
				name: "Shared",
				excludeId: ruleB.id,
			});
			expect(found?.id).toBe(ruleA.id);
		});
	});

	// ── toggleRuleEnabled ────────────────────────────────────────────────────────

	describe("toggleRuleEnabled", () => {
		it("disables an enabled rule", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Toggle me",
				condition: CONDITION,
				actions: ACTIONS,
				enabled: true,
			});

			const updated = await toggleRuleEnabled({
				id: rule.id,
				enabled: false,
			});

			expect(updated.enabled).toBe(false);
		});

		it("re-enables a disabled rule", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Re-enable me",
				condition: CONDITION,
				actions: ACTIONS,
				enabled: false,
			});

			const updated = await toggleRuleEnabled({
				id: rule.id,
				enabled: true,
			});

			expect(updated.enabled).toBe(true);
		});
	});

	// ── deleteRule ───────────────────────────────────────────────────────────────

	describe("deleteRule", () => {
		it("removes the rule from the database", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Delete me",
				condition: CONDITION,
				actions: ACTIONS,
			});

			await deleteRule(rule.id);

			const rules = await getRulesByMailboxId({
				mailboxId: seed.mailboxId,
			});
			expect(rules.find((r) => r.id === rule.id)).toBeUndefined();
		});
	});

	// ── verifyMailboxOwnership ───────────────────────────────────────────────────

	describe("verifyMailboxOwnership", () => {
		it("returns the mailbox when the user owns it", async () => {
			const mailbox = await verifyMailboxOwnership(
				seed.mailboxId,
				seed.userId,
			);
			expect(mailbox.id).toBe(seed.mailboxId);
		});

		it("throws NOT_FOUND for a non-existent mailbox id", async () => {
			await expect(
				verifyMailboxOwnership("mailbox-does-not-exist", seed.userId),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("throws FORBIDDEN when the user does not own the mailbox", async () => {
			await expect(
				verifyMailboxOwnership(seed.mailboxId, seed.otherUserId),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});

	// ── verifyRuleOwnership ──────────────────────────────────────────────────────

	describe("verifyRuleOwnership", () => {
		it("returns the rule when ownership is valid", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Owned rule",
				condition: CONDITION,
				actions: ACTIONS,
			});

			const verified = await verifyRuleOwnership(
				rule.id,
				seed.mailboxId,
				seed.userId,
			);
			expect(verified.id).toBe(rule.id);
		});

		it("throws NOT_FOUND for a non-existent rule id", async () => {
			await expect(
				verifyRuleOwnership(
					"rule-does-not-exist",
					seed.mailboxId,
					seed.userId,
				),
			).rejects.toMatchObject({ code: "NOT_FOUND" });
		});

		it("throws FORBIDDEN when the rule belongs to a different mailbox", async () => {
			const rule = await createRule({
				mailboxId: seed.mailboxId,
				name: "Wrong mailbox",
				condition: CONDITION,
				actions: ACTIONS,
			});

			await expect(
				verifyRuleOwnership(rule.id, "wrong-mailbox-id", seed.userId),
			).rejects.toMatchObject({ code: "FORBIDDEN" });
		});
	});
});
