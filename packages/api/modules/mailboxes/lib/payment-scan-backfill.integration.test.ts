/**
 * Integration tests for the payment-scan poller's per-tick batch processing.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import { db } from "@repo/database";
import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

vi.mock("./payment-classifier", () => ({
	classifyPaymentEmail: vi.fn(),
}));

maybeDescribe("payment-scan-backfill — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("payment-scan-backfill");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	beforeEach(async () => {
		vi.resetAllMocks();
	});

	afterEach(async () => {
		await db.paymentCard.deleteMany({
			where: { mailboxId: seed.mailboxId },
		});
		await db.email.deleteMany({ where: { mailboxId: seed.mailboxId } });
	});

	async function createUnscannedEmails(count: number) {
		const emails = [];
		for (let i = 0; i < count; i++) {
			const id = `test-backfill-${seed.mailboxId}-${i}`;
			emails.push(
				db.email.create({
					data: {
						id,
						mailboxId: seed.mailboxId,
						threadId: `thread-${id}`,
						from: "Acme Corp",
						fromEmail: "billing@acme.test",
						to: "user@example.com",
						subject: `Invoice ${i}`,
						snippet: "…",
						bodyText: "…",
						bodyHtml: "<p>…</p>",
						labelIds: ["INBOX"],
						isUnread: true,
						internalDate: new Date(Date.now() - i * 1000),
					},
				}),
			);
		}
		return Promise.all(emails);
	}

	it("isolates a failing email so the rest of the batch is still processed", async () => {
		const { classifyPaymentEmail } = await import("./payment-classifier");
		const { processDuePaymentScans } = await import(
			"./payment-scan-backfill"
		);

		await createUnscannedEmails(3);

		let call = 0;
		vi.mocked(classifyPaymentEmail).mockImplementation(async () => {
			call += 1;
			if (call === 2) {
				throw new Error("simulated classifier failure");
			}
			return { isPaymentEmail: false, confidence: 0 };
		});

		const result = await processDuePaymentScans();

		expect(result.scanned).toBe(3);
		expect(result.errors).toBe(1);

		// The two successful emails are marked scanned; the failed one is not,
		// so it will be retried on the next tick rather than being lost.
		const scanned = await db.email.count({
			where: {
				mailboxId: seed.mailboxId,
				paymentScanCategory: "not-payment",
			},
		});
		expect(scanned).toBe(2);
	});

	it("skips the Gemini call for an email already categorized as promotional/social/newsletter", async () => {
		const { classifyPaymentEmail } = await import("./payment-classifier");
		const { processDuePaymentScans } = await import(
			"./payment-scan-backfill"
		);

		const id = `test-backfill-fastpath-${seed.mailboxId}`;
		await db.email.create({
			data: {
				id,
				mailboxId: seed.mailboxId,
				threadId: `thread-${id}`,
				from: "Newsletter Co",
				fromEmail: "digest@newsletter.test",
				to: "user@example.com",
				subject: "This week's top picks",
				snippet: "…",
				bodyText: "…",
				bodyHtml: "<p>…</p>",
				labelIds: ["INBOX"],
				category: "NEWSLETTER",
				isUnread: true,
				internalDate: new Date(),
			},
		});

		const result = await processDuePaymentScans();

		expect(result.scanned).toBe(1);
		expect(classifyPaymentEmail).not.toHaveBeenCalled();

		const email = await db.email.findUniqueOrThrow({ where: { id } });
		expect(email.paymentScanCategory).toBe("not-payment");
	});

	it("leaves an email unscanned when Gemini's quota is exhausted, instead of mislabeling it", async () => {
		const { classifyPaymentEmail } = await import("./payment-classifier");
		const { processDuePaymentScans } = await import(
			"./payment-scan-backfill"
		);

		await createUnscannedEmails(1);
		vi.mocked(classifyPaymentEmail).mockResolvedValue(null);

		const result = await processDuePaymentScans();

		expect(result.scanned).toBe(0);
		expect(result.errors).toBe(0);

		const remaining = await db.email.count({
			where: { mailboxId: seed.mailboxId, paymentScanCategory: null },
		});
		expect(remaining).toBe(1);
	});

	it("only processes one bounded batch per mailbox per call, not the whole backlog", async () => {
		const { classifyPaymentEmail } = await import("./payment-classifier");
		const { processDuePaymentScans } = await import(
			"./payment-scan-backfill"
		);

		// More emails than the poller's per-mailbox batch size (10).
		await createUnscannedEmails(25);

		vi.mocked(classifyPaymentEmail).mockResolvedValue({
			isPaymentEmail: false,
			confidence: 0,
		});

		const result = await processDuePaymentScans();

		expect(result.scanned).toBe(10);

		const remaining = await db.email.count({
			where: { mailboxId: seed.mailboxId, paymentScanCategory: null },
		});
		expect(remaining).toBe(15);
	});
});
