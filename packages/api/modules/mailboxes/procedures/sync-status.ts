import { db, getMailboxSyncState } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const syncStatus = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/inbox/sync-status",
		tags: ["Mailboxes"],
		summary: "Report progress of the historical email sync",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const [state, syncedCount] = await Promise.all([
			getMailboxSyncState(mailbox.id),
			db.email.count({ where: { mailboxId: mailbox.id } }),
		]);

		return {
			// True once the full historical backfill has walked all the way back
			// to the first email in the account.
			complete: state?.emailSyncComplete ?? false,
			// How many emails have landed in the local DB so far.
			syncedCount,
		};
	});
