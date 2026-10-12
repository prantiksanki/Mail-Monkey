import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";
import { disableWatchForMailbox } from "../lib/watch-manager";

export const disableWatch = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/watch/disable",
		tags: ["Mailboxes"],
		summary: "Disable Gmail watch",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);
		await disableWatchForMailbox(
			mailbox.id,
			mailbox.accountId,
			mailbox.provider as "GOOGLE" | "OUTLOOK" | "IMAP",
			mailbox.subscriptionId,
		);
		return { success: true };
	});
