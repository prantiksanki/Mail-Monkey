/**
 * Integration tests for the automatic due-date reposition pass.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import { db } from "@repo/database";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";
import { repositionDuePaymentCards } from "./payment-reposition";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("payment-reposition — integration", () => {
	let seed: TestSeed;
	let emailCounter = 0;

	beforeAll(async () => {
		seed = await setupTestSeed("payment-reposition");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	afterEach(async () => {
		await db.paymentCard.deleteMany({
			where: { mailboxId: seed.mailboxId },
		});
		await db.email.deleteMany({ where: { mailboxId: seed.mailboxId } });
	});

	async function seedCard(overrides: {
		dueDate: Date | null;
		paymentStatus: string;
		kanbanStatus: "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID";
		statusSource: "AUTOMATIC" | "MANUAL";
	}) {
		emailCounter += 1;
		const emailId = `test-reposition-${seed.mailboxId}-${emailCounter}`;
		await db.email.create({
			data: {
				id: emailId,
				mailboxId: seed.mailboxId,
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
		return db.paymentCard.create({
			data: {
				userId: seed.userId,
				mailboxId: seed.mailboxId,
				emailId,
				threadId: `thread-${emailId}`,
				paymentType: "invoice",
				merchant: "Acme Corp",
				paymentStatus: overrides.paymentStatus,
				confidence: 0.9,
				dueDate: overrides.dueDate,
				kanbanStatus: overrides.kanbanStatus,
				statusSource: overrides.statusSource,
			},
		});
	}

	it("moves an UPCOMING card to OVERDUE once its due date has passed", async () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		const card = await seedCard({
			dueDate: yesterday,
			paymentStatus: "unpaid",
			kanbanStatus: "UPCOMING",
			statusSource: "AUTOMATIC",
		});

		const result = await repositionDuePaymentCards();
		expect(result.moved).toBeGreaterThanOrEqual(1);

		const updated = await db.paymentCard.findUnique({
			where: { id: card.id },
		});
		expect(updated?.kanbanStatus).toBe("OVERDUE");
	});

	it("moves an UPCOMING card to DUE_SOON once within the 3-day window", async () => {
		const twoDaysOut = new Date();
		twoDaysOut.setDate(twoDaysOut.getDate() + 2);

		const card = await seedCard({
			dueDate: twoDaysOut,
			paymentStatus: "unpaid",
			kanbanStatus: "UPCOMING",
			statusSource: "AUTOMATIC",
		});

		await repositionDuePaymentCards();

		const updated = await db.paymentCard.findUnique({
			where: { id: card.id },
		});
		expect(updated?.kanbanStatus).toBe("DUE_SOON");
	});

	it("never touches a MANUAL card even if its due date has passed", async () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		const card = await seedCard({
			dueDate: yesterday,
			paymentStatus: "unpaid",
			kanbanStatus: "UPCOMING",
			statusSource: "MANUAL",
		});

		await repositionDuePaymentCards();

		const updated = await db.paymentCard.findUnique({
			where: { id: card.id },
		});
		expect(updated?.kanbanStatus).toBe("UPCOMING");
	});

	it("never touches a PAID card", async () => {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);

		const card = await seedCard({
			dueDate: yesterday,
			paymentStatus: "paid",
			kanbanStatus: "PAID",
			statusSource: "AUTOMATIC",
		});

		await repositionDuePaymentCards();

		const updated = await db.paymentCard.findUnique({
			where: { id: card.id },
		});
		expect(updated?.kanbanStatus).toBe("PAID");
	});

	it("leaves a card unchanged when it's already in the correct column", async () => {
		const farOut = new Date();
		farOut.setDate(farOut.getDate() + 30);

		const card = await seedCard({
			dueDate: farOut,
			paymentStatus: "unpaid",
			kanbanStatus: "UPCOMING",
			statusSource: "AUTOMATIC",
		});

		const before = await db.paymentCard.findUnique({
			where: { id: card.id },
		});
		await repositionDuePaymentCards();
		const after = await db.paymentCard.findUnique({
			where: { id: card.id },
		});

		expect(after?.kanbanStatus).toBe("UPCOMING");
		expect(after?.updatedAt).toEqual(before?.updatedAt);
	});
});
