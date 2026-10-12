import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { sendEmailForMailbox } from "../lib/email-sender";
import { verifyMailboxOwnership } from "../lib/ownership";

export const sendEmail = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/send",
		tags: ["Mailboxes"],
		summary: "Send an email",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			to: z.string().min(1, "Recipient is required"),
			cc: z.string().optional(),
			bcc: z.string().optional(),
			subject: z.string().min(1, "Subject is required"),
			body: z.string().min(1, "Body is required"),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const { messageId } = await sendEmailForMailbox(mailbox.provider, {
			accountId: mailbox.accountId,
			from: mailbox.email,
			to: input.to,
			cc: input.cc,
			bcc: input.bcc,
			subject: input.subject,
			body: input.body,
		});

		return { success: true, messageId };
	});
