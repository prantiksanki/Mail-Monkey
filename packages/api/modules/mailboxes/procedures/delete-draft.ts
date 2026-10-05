import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteDraft as deleteDraftGmail } from "../lib/gmail-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const deleteDraftProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/drafts/{draftId}/delete",
		tags: ["Mailboxes"],
		summary: "Delete (discard) a draft",
	})
	.input(z.object({ mailboxId: z.string(), draftId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		await deleteDraftGmail(mailbox.accountId, input.draftId);

		return { success: true };
	});
