import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { sendDraft as sendDraftGmail } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const sendDraftProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/drafts/{draftId}/send",
		tags: ["Mailboxes"],
		summary: "Send a saved draft",
	})
	.input(z.object({ mailboxId: z.string(), draftId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const result = await sendDraftGmail(mailbox.accountId, input.draftId);

		return { success: true, messageId: result.id ?? null };
	});
