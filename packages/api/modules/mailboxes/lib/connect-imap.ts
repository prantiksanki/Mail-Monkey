import { ORPCError } from "@orpc/server";
import { createImapMailboxAccount, getMailboxByEmail } from "@repo/database";
import { logger } from "@repo/logs";
import { encryptImapPassword, verifyImapConnection } from "./imap-client";
import { syncAllImapEmails } from "./imap-sync";

export interface FinishImapConnectInput {
	userId: string;
	email: string;
	password: string;
	imapHost: string;
	imapPort: number;
	imapSecure: boolean;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
}

/**
 * Shared by `connectImapMailbox` (credentials supplied directly, already
 * logged in) and `finishPendingImapMailbox` (credentials recovered from a
 * server-side pending record after the pre-signup connect-mailbox flow) —
 * both end with the same verify-then-persist steps.
 */
export async function finishImapConnect(input: FinishImapConnectInput) {
	const email = input.email.toLowerCase();

	const existing = await getMailboxByEmail(email);
	if (existing && existing.userId === input.userId) {
		throw new ORPCError("CONFLICT", {
			message: `${email} is already connected.`,
		});
	}

	// Verify the credentials actually work before persisting anything — an
	// unverified save would leave the user with a mailbox that silently never
	// syncs, with no clear reason why.
	try {
		await verifyImapConnection({
			imapHost: input.imapHost,
			imapPort: input.imapPort,
			imapSecure: input.imapSecure,
			smtpHost: input.smtpHost,
			smtpPort: input.smtpPort,
			smtpSecure: input.smtpSecure,
			username: email,
			password: input.password,
		});
	} catch (error) {
		logger.warn("[connect-imap] Verification failed", {
			userId: input.userId,
			email,
			host: input.imapHost,
			error: error instanceof Error ? error.message : String(error),
		});
		throw new ORPCError("BAD_REQUEST", {
			message:
				"Couldn't connect with those details — check the host, port, and password (an app-specific password may be required) and try again.",
		});
	}

	const { mailbox } = await createImapMailboxAccount({
		userId: input.userId,
		email,
		imapHost: input.imapHost,
		imapPort: input.imapPort,
		imapSecure: input.imapSecure,
		smtpHost: input.smtpHost,
		smtpPort: input.smtpPort,
		smtpSecure: input.smtpSecure,
		imapPasswordEncrypted: encryptImapPassword(input.password),
	});

	// Fire-and-forget — the mailbox row already exists, so the UI can show it
	// immediately while history backfills in the background (same as the
	// OAuth providers' post-connect behavior).
	void syncAllImapEmails({
		id: mailbox.id,
		accountId: mailbox.accountId,
		email: mailbox.email,
	});

	logger.info("[connect-imap] Mailbox connected", {
		userId: input.userId,
		mailboxId: mailbox.id,
		email,
		host: input.imapHost,
	});

	return mailbox;
}
