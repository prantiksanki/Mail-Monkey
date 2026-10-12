import { markEmailUnread } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership } from "../lib/ownership";

export const markUnreadMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/mark-unread",
		tags: ["Mailboxes"],
		summary: "Mark an email message as unread",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			messageId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		await getMailProvider(mailbox.provider).markUnread(
			mailbox.accountId,
			input.messageId,
		);

		// Mirror in the local DB so the unread state survives an inbox refetch.
		await markEmailUnread(input.messageId);

		return { success: true };
	});
