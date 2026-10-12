import { createScheduledEmail } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";
import { UNDO_SEND_WINDOW_MS } from "../lib/send-with-undo-constants";

export { UNDO_SEND_WINDOW_MS };

export const sendWithUndo = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/send-with-undo",
		tags: ["Mailboxes"],
		summary: "Send an email after a short undoable delay",
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
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const scheduledAt = new Date(Date.now() + UNDO_SEND_WINDOW_MS);

		const scheduled = await createScheduledEmail({
			mailboxId: input.mailboxId,
			to: input.to,
			cc: input.cc,
			bcc: input.bcc,
			subject: input.subject,
			body: input.body,
			scheduledAt,
		});

		return {
			scheduledEmailId: scheduled.id,
			sendAt: scheduled.scheduledAt.toISOString(),
		};
	});
