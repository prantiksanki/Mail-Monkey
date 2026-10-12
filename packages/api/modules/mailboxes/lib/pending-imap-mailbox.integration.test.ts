/**
 * Integration tests for the server-side "pending IMAP mailbox" handoff used
 * by the pre-signup connect-mailbox flow (replaces the earlier sessionStorage
 * bridge — see verify-imap-mailbox.ts / finish-pending-imap-mailbox.ts).
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	db,
	takePendingImapMailbox,
	upsertPendingImapMailbox,
} from "@repo/database";
import { afterEach, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

const baseInput = {
	email: "Pending-User@Example.com",
	imapHost: "imap.example.com",
	imapPort: 993,
	imapSecure: true,
	smtpHost: "smtp.example.com",
	smtpPort: 465,
	smtpSecure: true,
	passwordEncrypted: "encrypted-placeholder",
};

maybeDescribe("pending IMAP mailbox handoff — integration", () => {
	afterEach(async () => {
		await db.pendingImapMailbox.deleteMany({
			where: { email: baseInput.email.toLowerCase() },
		});
	});

	it("normalizes email casing on write and read", async () => {
		await upsertPendingImapMailbox(baseInput);

		const stored = await db.pendingImapMailbox.findUnique({
			where: { email: "pending-user@example.com" },
		});
		expect(stored).not.toBeNull();
		expect(stored?.imapHost).toBe(baseInput.imapHost);
	});

	it("is single-use — a second take returns null", async () => {
		await upsertPendingImapMailbox(baseInput);

		const first = await takePendingImapMailbox(baseInput.email);
		expect(first).not.toBeNull();
		expect(first?.imapHost).toBe(baseInput.imapHost);

		const second = await takePendingImapMailbox(baseInput.email);
		expect(second).toBeNull();
	});

	it("returns null when there is no pending record", async () => {
		const result = await takePendingImapMailbox(
			"nobody-pending@example.com",
		);
		expect(result).toBeNull();
	});

	it("returns null (and deletes the row) for an expired record", async () => {
		await upsertPendingImapMailbox(baseInput);
		await db.pendingImapMailbox.update({
			where: { email: baseInput.email.toLowerCase() },
			data: { expiresAt: new Date(Date.now() - 1000) },
		});

		const result = await takePendingImapMailbox(baseInput.email);
		expect(result).toBeNull();

		const stillThere = await db.pendingImapMailbox.findUnique({
			where: { email: baseInput.email.toLowerCase() },
		});
		expect(stillThere).toBeNull();
	});

	it("a resend (fresh submit) replaces the earlier pending record for the same email", async () => {
		await upsertPendingImapMailbox(baseInput);
		await upsertPendingImapMailbox({
			...baseInput,
			imapHost: "imap2.example.com",
		});

		const stored = await db.pendingImapMailbox.findUnique({
			where: { email: baseInput.email.toLowerCase() },
		});
		expect(stored?.imapHost).toBe("imap2.example.com");

		// And only one row exists, not two.
		const count = await db.pendingImapMailbox.count({
			where: { email: baseInput.email.toLowerCase() },
		});
		expect(count).toBe(1);
	});
});
