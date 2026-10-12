import { ORPCError } from "@orpc/server";
import { upsertPendingImapMailbox } from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import {
	assertPublicHost,
	encryptImapPassword,
	verifyImapConnection,
} from "../lib/imap-client";
import { ConnectImapMailboxSchema } from "../types";

/**
 * Public (unauthenticated) live-verify for the pre-signup "connect your
 * custom email" flow — lets a visitor with no MailMonkey account yet confirm
 * their IMAP/SMTP details work *before* we send them a magic-link signup
 * email.
 *
 * Verified credentials are persisted server-side (encrypted) as a pending
 * record keyed by email, rather than only being handed back to the client
 * to stash in sessionStorage — that way the handoff to the authenticated
 * `connectImap` finish step survives the user opening the magic-link email
 * on a different browser/device than the one that submitted this form.
 */
export const verifyImapMailbox = publicProcedure
	.route({
		method: "POST",
		path: "/mailboxes/verify-imap",
		tags: ["Mailboxes"],
		summary: "Live-verify custom-domain IMAP/SMTP credentials pre-signup",
	})
	.input(ConnectImapMailboxSchema)
	.handler(async ({ input }) => {
		const email = input.email.toLowerCase();

		await assertPublicHost(input.imapHost);
		await assertPublicHost(input.smtpHost);

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
			logger.warn("[verify-imap-mailbox] Verification failed", {
				email,
				host: input.imapHost,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new ORPCError("BAD_REQUEST", {
				message:
					"Couldn't connect with those details — check the host, port, and password (an app-specific password may be required) and try again.",
			});
		}

		await upsertPendingImapMailbox({
			email,
			imapHost: input.imapHost,
			imapPort: input.imapPort,
			imapSecure: input.imapSecure,
			smtpHost: input.smtpHost,
			smtpPort: input.smtpPort,
			smtpSecure: input.smtpSecure,
			passwordEncrypted: encryptImapPassword(input.password),
		});

		return { verified: true };
	});
