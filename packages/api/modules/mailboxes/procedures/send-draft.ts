import { ORPCError } from "@orpc/client";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { sendDraft as sendDraftGmail } from "../lib/gmail-client";
import { sendImapDraft } from "../lib/imap-drafts";
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

		if (mailbox.provider === "OUTLOOK") {
			throw new ORPCError("BAD_REQUEST", {
				message: "Drafts aren't supported for Outlook mailboxes yet.",
			});
		}

		if (mailbox.provider === "IMAP") {
			const sent = await sendImapDraft(
				mailbox.accountId,
				input.draftId,
				mailbox.email,
			);
			if (!sent) {
				throw new ORPCError("NOT_FOUND", {
					message: "This draft no longer exists.",
				});
			}
			return { success: true, messageId: sent.messageId };
		}

		const result = await sendDraftGmail(mailbox.accountId, input.draftId);

		return { success: true, messageId: result.id ?? null };
	});
