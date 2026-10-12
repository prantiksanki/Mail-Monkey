import { ORPCError } from "@orpc/server";
import { parseGaCookies } from "@repo/analytics";
import { trackMailboxConnect } from "@repo/auth/lib/analytics-events";
import { takePendingImapMailbox } from "@repo/database";
import { decryptToken } from "@repo/utils/lib/token-crypto";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { finishImapConnect } from "../lib/connect-imap";

/**
 * Finishes the pre-signup "connect your custom email" flow
 * (`/auth/connect-mailbox`): that page verifies IMAP/SMTP credentials with
 * no account yet and stashes them server-side (see `verifyImap`), then sends
 * a magic-link signup/login email. There's no session at that point to
 * create the mailbox row under, so the authenticated finish step lives here
 * — called once the user has a session, regardless of which
 * browser/device completed the magic-link click.
 *
 * A no-op (returns `connected: false`) if there's no pending record for the
 * signed-in user's email — e.g. an ordinary login with nothing pending.
 */
export const finishPendingImapMailbox = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/finish-pending-imap",
		tags: ["Mailboxes"],
		summary:
			"Finish connecting a custom-domain mailbox from a pending pre-signup record",
	})
	.input(z.object({}).optional())
	.handler(async ({ context }) => {
		const email = context.user.email?.toLowerCase();
		if (!email) {
			return { connected: false as const };
		}

		const pending = await takePendingImapMailbox(email);
		if (!pending) {
			return { connected: false as const };
		}

		const password = decryptToken(pending.passwordEncrypted);
		if (!password) {
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Couldn't recover the pending mailbox credentials.",
			});
		}

		const mailbox = await finishImapConnect({
			userId: context.user.id,
			email: pending.email,
			password,
			imapHost: pending.imapHost,
			imapPort: pending.imapPort,
			imapSecure: pending.imapSecure,
			smtpHost: pending.smtpHost,
			smtpPort: pending.smtpPort,
			smtpSecure: pending.smtpSecure,
		});

		await trackMailboxConnect(
			{ userId: context.user.id, providerId: "imap" },
			parseGaCookies(context.headers.get("cookie")),
		);

		return {
			connected: true as const,
			mailboxId: mailbox.id,
			email: mailbox.email,
		};
	});
