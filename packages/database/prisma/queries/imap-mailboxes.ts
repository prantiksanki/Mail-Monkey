import { db } from "../client";

// Pending records outlive the magic-link they're paired with (default 5 min
// TTL) so a resend still has something to finish against — see
// PendingImapMailboxConnector.tsx / the connect-mailbox auth flow.
const PENDING_IMAP_MAILBOX_TTL_MS = 30 * 60 * 1000;

export interface UpsertPendingImapMailboxInput {
	email: string;
	imapHost: string;
	imapPort: number;
	imapSecure: boolean;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
	passwordEncrypted: string;
}

/**
 * Persists verified-but-not-yet-connected IMAP/SMTP credentials for the
 * pre-signup "connect your custom email" flow, keyed by email so a fresh
 * submit (e.g. a resend) simply replaces whatever was pending before.
 *
 * This is the server-side replacement for stashing the form values in
 * sessionStorage: it survives the user opening the magic-link email on a
 * different browser/device than the one that submitted the form.
 */
export async function upsertPendingImapMailbox(
	input: UpsertPendingImapMailboxInput,
) {
	const email = input.email.toLowerCase();
	const expiresAt = new Date(Date.now() + PENDING_IMAP_MAILBOX_TTL_MS);

	return db.pendingImapMailbox.upsert({
		where: { email },
		create: {
			email,
			imapHost: input.imapHost,
			imapPort: input.imapPort,
			imapSecure: input.imapSecure,
			smtpHost: input.smtpHost,
			smtpPort: input.smtpPort,
			smtpSecure: input.smtpSecure,
			passwordEncrypted: input.passwordEncrypted,
			expiresAt,
		},
		update: {
			imapHost: input.imapHost,
			imapPort: input.imapPort,
			imapSecure: input.imapSecure,
			smtpHost: input.smtpHost,
			smtpPort: input.smtpPort,
			smtpSecure: input.smtpSecure,
			passwordEncrypted: input.passwordEncrypted,
			expiresAt,
		},
	});
}

/**
 * Reads and deletes the pending IMAP mailbox record for an email in one
 * transaction (single-use, mirrors how Better Auth consumes its own
 * verification tokens). Returns null if there is none, or if it expired —
 * an expired record is deleted anyway so it doesn't linger.
 */
export async function takePendingImapMailbox(email: string) {
	const normalizedEmail = email.toLowerCase();

	return db.$transaction(async (tx) => {
		const pending = await tx.pendingImapMailbox.findUnique({
			where: { email: normalizedEmail },
		});
		if (!pending) {
			return null;
		}

		await tx.pendingImapMailbox.delete({ where: { id: pending.id } });

		if (pending.expiresAt < new Date()) {
			return null;
		}

		return pending;
	});
}

export interface CreateImapMailboxInput {
	userId: string;
	email: string;
	imapHost: string;
	imapPort: number;
	imapSecure: boolean;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
	imapPasswordEncrypted: string;
}

/**
 * Creates the Account (IMAP/SMTP credentials) and Mailbox rows for a
 * custom-domain mailbox in one transaction — mirrors what Better Auth's own
 * account-creation hooks do for Google/Microsoft (packages/auth/auth.ts),
 * except this path is invoked directly by connect-imap-mailbox.ts since
 * there's no OAuth callback to hang a hook off of.
 *
 * `Account.accountId` is set to the mailbox's own email address — the login
 * username for virtually every IMAP/SMTP host — and doubles as the value
 * getImapCredentials() reads back as the auth username.
 */
export async function createImapMailboxAccount(input: CreateImapMailboxInput) {
	return db.$transaction(async (tx) => {
		const account = await tx.account.create({
			data: {
				accountId: input.email,
				providerId: "imap",
				userId: input.userId,
				imapHost: input.imapHost,
				imapPort: input.imapPort,
				imapSecure: input.imapSecure,
				smtpHost: input.smtpHost,
				smtpPort: input.smtpPort,
				smtpSecure: input.smtpSecure,
				imapPasswordEncrypted: input.imapPasswordEncrypted,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});

		const mailbox = await tx.mailbox.create({
			data: {
				userId: input.userId,
				accountId: account.id,
				email: input.email,
				provider: "IMAP",
				// No watch/subscription concept for generic IMAP — mail arrives via
				// imap-sync-poller.ts regardless, so this mailbox is always "watched".
				watchEnabled: true,
			},
		});

		return { account, mailbox };
	});
}
