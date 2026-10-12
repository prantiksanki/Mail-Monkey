/**
 * Integration tests for the undo-send flow: sendWithUndo queues a
 * ScheduledEmail row a few seconds out, and canceling it before that time
 * behaves exactly like canceling a genuine "send later" schedule.
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	cancelScheduledEmail,
	createScheduledEmail,
	getDueScheduledEmails,
	getScheduledEmailById,
} from "@repo/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { TestSeed } from "../../../test-helpers/db-seed";
import { setupTestSeed, teardownTestSeed } from "../../../test-helpers/db-seed";
import { UNDO_SEND_WINDOW_MS } from "./send-with-undo";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("sendWithUndo — integration", () => {
	let seed: TestSeed;

	beforeAll(async () => {
		seed = await setupTestSeed("send-with-undo");
	});

	afterAll(async () => {
		await teardownTestSeed(seed);
	});

	beforeEach(async () => {
		const { db } = await import("@repo/database");
		await db.scheduledEmail.deleteMany({
			where: { mailboxId: seed.mailboxId },
		});
	});

	it("queues the email in the future, not due immediately", async () => {
		const scheduledAt = new Date(Date.now() + UNDO_SEND_WINDOW_MS);
		const scheduled = await createScheduledEmail({
			mailboxId: seed.mailboxId,
			to: "recipient@example.com",
			subject: "Undo me",
			body: "hello",
			scheduledAt,
		});

		expect(scheduled.status).toBe("PENDING");

		const dueNow = await getDueScheduledEmails(new Date());
		expect(dueNow.find((e) => e.id === scheduled.id)).toBeUndefined();
	});

	it("canceling before the window elapses marks it CANCELED and excludes it from due sends", async () => {
		const scheduledAt = new Date(Date.now() + UNDO_SEND_WINDOW_MS);
		const scheduled = await createScheduledEmail({
			mailboxId: seed.mailboxId,
			to: "recipient@example.com",
			subject: "Undo me",
			body: "hello",
			scheduledAt,
		});

		const count = await cancelScheduledEmail(scheduled.id, seed.mailboxId);
		expect(count).toBe(1);

		const updated = await getScheduledEmailById(scheduled.id);
		expect(updated?.status).toBe("CANCELED");

		// Even once the window has passed, a canceled row is never "due".
		const dueAfterWindow = await getDueScheduledEmails(
			new Date(scheduledAt.getTime() + 1000),
		);
		expect(
			dueAfterWindow.find((e) => e.id === scheduled.id),
		).toBeUndefined();
	});

	it("is due once the window has elapsed, if not canceled", async () => {
		const scheduledAt = new Date(Date.now() + UNDO_SEND_WINDOW_MS);
		const scheduled = await createScheduledEmail({
			mailboxId: seed.mailboxId,
			to: "recipient@example.com",
			subject: "Send me",
			body: "hello",
			scheduledAt,
		});

		const dueAfterWindow = await getDueScheduledEmails(
			new Date(scheduledAt.getTime() + 1000),
		);
		expect(dueAfterWindow.find((e) => e.id === scheduled.id)).toBeDefined();
	});

	it("canceling twice is a no-op the second time (already-sent/canceled rows can't be re-canceled)", async () => {
		const scheduled = await createScheduledEmail({
			mailboxId: seed.mailboxId,
			to: "recipient@example.com",
			subject: "Undo me",
			body: "hello",
			scheduledAt: new Date(Date.now() + UNDO_SEND_WINDOW_MS),
		});

		const first = await cancelScheduledEmail(scheduled.id, seed.mailboxId);
		expect(first).toBe(1);

		const second = await cancelScheduledEmail(scheduled.id, seed.mailboxId);
		expect(second).toBe(0);
	});

	it("cannot be canceled through a different mailbox", async () => {
		const scheduled = await createScheduledEmail({
			mailboxId: seed.mailboxId,
			to: "recipient@example.com",
			subject: "Undo me",
			body: "hello",
			scheduledAt: new Date(Date.now() + UNDO_SEND_WINDOW_MS),
		});

		const count = await cancelScheduledEmail(
			scheduled.id,
			"not-this-mailbox",
		);
		expect(count).toBe(0);

		const stillPending = await getScheduledEmailById(scheduled.id);
		expect(stillPending?.status).toBe("PENDING");
	});
});
