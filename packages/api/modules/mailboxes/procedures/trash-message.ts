import { getEmailById, updateEmailLabels } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership } from "../lib/ownership";

export const trashMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/trash",
		tags: ["Mailboxes"],
		summary: "Move an email message to trash",
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

		await getMailProvider(mailbox.provider).trash(
			mailbox.accountId,
			input.messageId,
		);

		// Mirror the change in the local DB so the message leaves the
		// DB-served inbox immediately (Gmail labels move to TRASH).
		const localEmail = await getEmailById(input.mailboxId, input.messageId);
		if (localEmail) {
			const labels = localEmail.labelIds.filter(
				(l) => l !== "INBOX" && l !== "TRASH",
			);
			labels.push("TRASH");
			await updateEmailLabels(input.messageId, labels);
		}

		return { success: true };
	});
