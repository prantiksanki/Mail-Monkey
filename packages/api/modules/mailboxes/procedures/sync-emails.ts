import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { syncAllEmails, syncRecentEmails } from "../lib/email-sync";
import { syncAllImapEmails, syncRecentImapEmails } from "../lib/imap-sync";
import {
	syncAllOutlookEmails,
	syncRecentOutlookEmails,
} from "../lib/outlook-sync";
import { verifyMailboxOwnership } from "../lib/ownership";

export const syncEmails = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/sync",
		tags: ["Mailboxes"],
		summary: "Sync recent emails into the local DB",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			// "recent" pulls the newest messages and awaits completion so the
			// caller can immediately refetch. "full" kicks off a background
			// historical backfill and returns right away.
			mode: z.enum(["recent", "full"]).default("recent"),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const mailboxRef = {
			id: mailbox.id,
			accountId: mailbox.accountId,
			email: mailbox.email,
		};

		if (input.mode === "full") {
			// Fire-and-forget — returns immediately; sync runs in background
			if (mailbox.provider === "OUTLOOK") {
				void syncAllOutlookEmails(mailboxRef);
			} else if (mailbox.provider === "IMAP") {
				void syncAllImapEmails(mailboxRef);
			} else {
				void syncAllEmails(mailboxRef);
			}
			return { started: true, synced: null };
		}

		const synced =
			mailbox.provider === "OUTLOOK"
				? await syncRecentOutlookEmails(mailboxRef)
				: mailbox.provider === "IMAP"
					? await syncRecentImapEmails(mailboxRef)
					: await syncRecentEmails(mailboxRef);

		return { started: true, synced };
	});
