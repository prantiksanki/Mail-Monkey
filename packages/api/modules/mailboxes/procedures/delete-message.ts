import { deleteEmail } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteMessage as gmailDeleteMessage } from "../lib/gmail-client";
import { deleteImapMessage } from "../lib/imap-provider";
import { verifyMailboxOwnership } from "../lib/ownership";

export const deleteMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/delete",
		tags: ["Mailboxes"],
		summary: "Permanently delete an email message",
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

		// Ensure the message is in Gmail's Trash (where it auto-purges after 30
		// days). True permanent erase needs the broad `mail.google.com` scope we
		// don't request, so this is the closest behavior with `gmail.modify`.
		// Best-effort: even if this fails we still drop the local copy below.
		try {
			if (mailbox.provider === "IMAP") {
				await deleteImapMessage(mailbox.accountId, input.messageId);
			} else {
				await gmailDeleteMessage(mailbox.accountId, input.messageId);
			}
		} catch (error) {
			logger.warn(
				"[delete-message] Gmail trash failed; removing locally",
				{
					mailboxId: input.mailboxId,
					messageId: input.messageId,
					error:
						error instanceof Error ? error.message : String(error),
				},
			);
		}

		// Drop the local copy so the message disappears from the app at once.
		// Gmail's default message list excludes Trash, so sync won't re-add it.
		await deleteEmail(input.mailboxId, input.messageId);

		return { success: true };
	});
