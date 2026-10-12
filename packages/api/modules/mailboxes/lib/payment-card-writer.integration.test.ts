/**
 * Integration tests for PaymentCard writes.
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
import { upsertPaymentCardFromClassification } from "./payment-card-writer";
import type { PaymentClassification } from "./payment-classifier";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("payment-card-writer — integration", () => {
	let seed: TestSeed;
	let emailIdCounter = 0;

	beforeAll(async () => {
		seed = await setupTestSeed("payment-card-writer");
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

	async function createTestEmail(
		overrides: Partial<{ subject: string }> = {},
	) {
		emailIdCounter += 1;
		const id = `test-msg-${seed.mailboxId}-${emailIdCounter}`;
		return db.email.create({
			data: {
				id,
				mailboxId: seed.mailboxId,
				threadId: `thread-${id}`,
				from: "Acme Corp",
				fromEmail: "billing@acme.test",
				to: "user@example.com",
				subject: overrides.subject ?? "Invoice #1001",
				snippet: "Your invoice is ready",
				bodyText: "Your invoice for $100 is due on 2026-09-01.",
				bodyHtml: "<p>Your invoice for $100 is due on 2026-09-01.</p>",
				labelIds: ["INBOX"],
				isUnread: true,
				internalDate: new Date(),
			},
		});
	}

	const AUTOMATIC_CLASSIFICATION: PaymentClassification = {
		isPaymentEmail: true,
		paymentType: "invoice",
		merchant: "Acme Corp",
		amount: 100,
		currency: "USD",
		dueDate: "2026-09-01",
		paymentStatus: "unpaid",
		confidence: 0.9,
	};

	it("creates exactly one PaymentCard when the same email is classified twice", async () => {
		const email = await createTestEmail();

		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			AUTOMATIC_CLASSIFICATION,
		);
		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			AUTOMATIC_CLASSIFICATION,
		);

		const cards = await db.paymentCard.findMany({
			where: { mailboxId: email.mailboxId, emailId: email.id },
		});
		expect(cards).toHaveLength(1);
	});

	it("does not create a card when confidence is below the threshold", async () => {
		const email = await createTestEmail();

		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			{ isPaymentEmail: true, confidence: 0.3 },
		);

		const card = await db.paymentCard.findUnique({
			where: {
				mailboxId_emailId: {
					mailboxId: email.mailboxId,
					emailId: email.id,
				},
			},
		});
		expect(card).toBeNull();

		const updatedEmail = await db.email.findUnique({
			where: { id: email.id },
		});
		expect(updatedEmail?.paymentScanCategory).toBe("not-payment");
	});

	it("does not create a card when isPaymentEmail is false", async () => {
		const email = await createTestEmail();

		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			{ isPaymentEmail: false, confidence: 0 },
		);

		const card = await db.paymentCard.findUnique({
			where: {
				mailboxId_emailId: {
					mailboxId: email.mailboxId,
					emailId: email.id,
				},
			},
		});
		expect(card).toBeNull();
	});

	it("never overwrites a manually-overridden card's kanbanStatus/statusSource", async () => {
		const email = await createTestEmail();

		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			AUTOMATIC_CLASSIFICATION,
		);

		// Simulate the user dragging the card to PAID manually.
		await db.paymentCard.update({
			where: {
				mailboxId_emailId: {
					mailboxId: email.mailboxId,
					emailId: email.id,
				},
			},
			data: {
				kanbanStatus: "PAID",
				statusSource: "MANUAL",
				manuallyOverriddenAt: new Date(),
			},
		});

		// A subsequent re-classification runs (e.g. poller re-scans) with a
		// different due date that would normally move the card to OVERDUE.
		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			{
				...AUTOMATIC_CLASSIFICATION,
				dueDate: "2020-01-01",
				paymentStatus: "unpaid",
			},
		);

		const card = await db.paymentCard.findUnique({
			where: {
				mailboxId_emailId: {
					mailboxId: email.mailboxId,
					emailId: email.id,
				},
			},
		});
		expect(card?.kanbanStatus).toBe("PAID");
		expect(card?.statusSource).toBe("MANUAL");
	});

	it("does not let a confident 'paid' signal flip a manually-set card", async () => {
		const email = await createTestEmail();

		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			AUTOMATIC_CLASSIFICATION,
		);

		await db.paymentCard.update({
			where: {
				mailboxId_emailId: {
					mailboxId: email.mailboxId,
					emailId: email.id,
				},
			},
			data: {
				kanbanStatus: "UPCOMING",
				statusSource: "MANUAL",
				manuallyOverriddenAt: new Date(),
			},
		});

		// A high-confidence "paid" classification arrives — must still not move
		// the card, because a human already decided its column.
		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			{
				isPaymentEmail: true,
				paymentType: "receipt",
				merchant: "Acme Corp",
				paymentStatus: "paid",
				confidence: 0.99,
			},
		);

		const card = await db.paymentCard.findUnique({
			where: {
				mailboxId_emailId: {
					mailboxId: email.mailboxId,
					emailId: email.id,
				},
			},
		});
		expect(card?.kanbanStatus).toBe("UPCOMING");
		expect(card?.statusSource).toBe("MANUAL");
	});

	it("marks the source email as scanned after processing", async () => {
		const email = await createTestEmail();

		await upsertPaymentCardFromClassification(
			seed.userId,
			{
				id: email.id,
				mailboxId: email.mailboxId,
				threadId: email.threadId,
			},
			AUTOMATIC_CLASSIFICATION,
		);

		const updatedEmail = await db.email.findUnique({
			where: { id: email.id },
		});
		expect(updatedEmail?.paymentScanCategory).toBe("payment");
	});
});
