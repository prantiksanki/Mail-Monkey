import { ORPCError } from "@orpc/client";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { deleteDraft as deleteDraftGmail } from "../lib/gmail-client";
import { deleteImapDraft } from "../lib/imap-drafts";
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

		if (mailbox.provider === "OUTLOOK") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Drafts aren't supported for Outlook mailboxes yet.",
			});
		}

		if (mailbox.provider === "IMAP") {
			await deleteImapDraft(mailbox.accountId, input.draftId);
			return { success: true };
		}

		await deleteDraftGmail(mailbox.accountId, input.draftId);

		return { success: true };
	});
