import { markEmailRead } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { modifyMessageLabels } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const markReadMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/mark-read",
		tags: ["Mailboxes"],
		summary: "Mark an email message as read",
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

		await modifyMessageLabels(
			mailbox.accountId,
			input.messageId,
			[],
			["UNREAD"],
		);

		// Mirror in the local DB so the read state survives an inbox refetch.
		await markEmailRead(input.messageId);

		return { success: true };
	});
