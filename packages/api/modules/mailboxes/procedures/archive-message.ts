import { getEmailById, updateEmailLabels } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership } from "../lib/ownership";

export const archiveMessage = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}/archive",
		tags: ["Mailboxes"],
		summary: "Archive an email message",
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

		await getMailProvider(mailbox.provider).archive(
			mailbox.accountId,
			input.messageId,
		);

		// Mirror the change in the local DB so the message leaves the
		// DB-served inbox immediately (archive == remove the INBOX label).
		const localEmail = await getEmailById(input.mailboxId, input.messageId);
		if (localEmail) {
			await updateEmailLabels(
				input.messageId,
				localEmail.labelIds.filter((l) => l !== "INBOX"),
			);
		}

		return { success: true };
	});
