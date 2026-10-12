/**
 * Integration tests for the payment-tracking board queries used by
 * list-cards.ts and update-card-status.ts.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	db,
	getPaymentCardById,
	getPaymentCardsForBoard,
	updatePaymentCardStatus,
	upsertPaymentCard,
} from "@repo/database";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("payment-tracking board — integration", () => {
	let seed: TestSeed;
	let secondMailboxId: string;
	let emailCounter = 0;

	beforeAll(async () => {
		seed = await setupTestSeed("payment-tracking-list-cards");

		// A second mailbox for the same user, to test multi-mailbox aggregation.
		const secondAccount = await db.account.create({
			data: {
				accountId: "acc-payment-tracking-second",
				providerId: "microsoft",
				userId: seed.userId,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
		const secondMailbox = await db.mailbox.create({
			data: {
				userId: seed.userId,
				accountId: secondAccount.id,
				email: "second-payment-tracking@zeromail-test.invalid",
				provider: "OUTLOOK",
			},
		});
		secondMailboxId = secondMailbox.id;
	});

	afterAll(async () => {
		await db.mailbox.deleteMany({ where: { id: secondMailboxId } });
		await teardownTestSeed(seed);
	});

	afterEach(async () => {
		await db.paymentCard.deleteMany({
			where: { mailboxId: { in: [seed.mailboxId, secondMailboxId] } },
		});
		await db.email.deleteMany({
			where: { mailboxId: { in: [seed.mailboxId, secondMailboxId] } },
		});
	});

	async function seedCard(
		mailboxId: string,
		userId: string,
		paymentType = "invoice",
	) {
		emailCounter += 1;
		const emailId = `test-msg-list-cards-${mailboxId}-${emailCounter}`;
		await db.email.create({
			data: {
				id: emailId,
				mailboxId,
				threadId: `thread-${emailId}`,
				from: "Acme Corp",
				fromEmail: "billing@acme.test",
				to: "user@example.com",
				subject: "Invoice",
				snippet: "…",
				bodyText: "…",
				bodyHtml: "<p>…</p>",
				labelIds: ["INBOX"],
				isUnread: true,
				internalDate: new Date(),
			},
		});
		return upsertPaymentCard({
			userId,
			mailboxId,
			emailId,
			threadId: `thread-${emailId}`,
			paymentType,
			merchant: "Acme Corp",
			amount: 100,
			currency: "USD",
			dueDate: new Date(),
			paymentStatus: "unpaid",
			confidence: 0.9,
			kanbanStatus: "UPCOMING",
			statusSource: "AUTOMATIC",
		});
	}

	it("returns an empty list when the user has no payment cards", async () => {
		const result = await getPaymentCardsForBoard(seed.userId, {
			limit: 20,
		});
		expect(result).toEqual([]);
	});

	it("does not return another user's payment cards (cross-user isolation)", async () => {
		await seedCard(seed.mailboxId, seed.otherUserId);

		const result = await getPaymentCardsForBoard(seed.userId, {
			limit: 20,
		});
		expect(result).toEqual([]);
	});

	it("aggregates cards across all of the user's mailboxes by default", async () => {
		await seedCard(seed.mailboxId, seed.userId);
		await seedCard(secondMailboxId, seed.userId);

		const result = await getPaymentCardsForBoard(seed.userId, {
			limit: 20,
		});
		expect(result).toHaveLength(2);
	});

	it("narrows to a single mailbox when mailboxId filter is given", async () => {
		await seedCard(seed.mailboxId, seed.userId);
		await seedCard(secondMailboxId, seed.userId);

		const result = await getPaymentCardsForBoard(seed.userId, {
			mailboxId: seed.mailboxId,
			limit: 20,
		});
		expect(result).toHaveLength(1);
		expect(result[0].mailboxId).toBe(seed.mailboxId);
	});

	it("rejects a mailboxId owned by a different user via verifyMailboxOwnership", async () => {
		const otherAccount = await db.account.create({
			data: {
				accountId: "acc-payment-tracking-foreign",
				providerId: "google",
				userId: seed.otherUserId,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
		const foreignMailbox = await db.mailbox.create({
			data: {
				userId: seed.otherUserId,
				accountId: otherAccount.id,
				email: "foreign-payment-tracking@zeromail-test.invalid",
				provider: "GOOGLE",
			},
		});

		await expect(
			verifyMailboxOwnership(foreignMailbox.id, seed.userId),
		).rejects.toThrow();

		await db.mailbox.delete({ where: { id: foreignMailbox.id } });
	});

	it("filters by kanbanStatus", async () => {
		await seedCard(seed.mailboxId, seed.userId);

		expect(
			await getPaymentCardsForBoard(seed.userId, {
				kanbanStatus: "UPCOMING",
				limit: 20,
			}),
		).toHaveLength(1);

		expect(
			await getPaymentCardsForBoard(seed.userId, {
				kanbanStatus: "PAID",
				limit: 20,
			}),
		).toEqual([]);
	});

	it("filters by paymentType", async () => {
		await seedCard(seed.mailboxId, seed.userId, "invoice");
		await seedCard(seed.mailboxId, seed.userId, "subscription");

		const invoices = await getPaymentCardsForBoard(seed.userId, {
			paymentType: "invoice",
			limit: 20,
		});
		expect(invoices).toHaveLength(1);
		expect(invoices[0].paymentType).toBe("invoice");

		const subscriptions = await getPaymentCardsForBoard(seed.userId, {
			paymentType: "subscription",
			limit: 20,
		});
		expect(subscriptions).toHaveLength(1);
		expect(subscriptions[0].paymentType).toBe("subscription");

		expect(
			await getPaymentCardsForBoard(seed.userId, {
				paymentType: "receipt",
				limit: 20,
			}),
		).toEqual([]);
	});

	describe("updatePaymentCardStatus (drag-and-drop persistence)", () => {
		it("persists the new column and marks the card as manually overridden", async () => {
			const card = await seedCard(seed.mailboxId, seed.userId);

			await updatePaymentCardStatus(card.id, {
				kanbanStatus: "PAID",
				statusSource: "MANUAL",
				manuallyOverriddenAt: new Date(),
			});

			const updated = await getPaymentCardById(card.id, seed.userId);
			expect(updated?.kanbanStatus).toBe("PAID");
			expect(updated?.statusSource).toBe("MANUAL");
			expect(updated?.manuallyOverriddenAt).not.toBeNull();
		});

		it("getPaymentCardById returns null for a card scoped to a different user", async () => {
			const card = await seedCard(seed.mailboxId, seed.userId);

			const result = await getPaymentCardById(card.id, seed.otherUserId);
			expect(result).toBeNull();
		});
	});
});
