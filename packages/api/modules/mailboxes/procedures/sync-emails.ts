import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { syncAllEmails, syncRecentEmails } from "../lib/email-sync";
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

		if (input.mode === "full") {
			// Fire-and-forget — returns immediately; sync runs in background
			void syncAllEmails({
				id: mailbox.id,
				accountId: mailbox.accountId,
				email: mailbox.email,
			});
			return { started: true, synced: null };
		}

		// Incremental sync is only implemented for Gmail; Outlook falls back to
		// its live list path in list-inbox-messages, so a no-op is fine here.
		if (mailbox.provider !== "GOOGLE") {
			return { started: true, synced: 0 };
		}

		const synced = await syncRecentEmails({
			id: mailbox.id,
			accountId: mailbox.accountId,
			email: mailbox.email,
		});

		return { started: true, synced };
	});
