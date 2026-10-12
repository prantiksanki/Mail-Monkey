import { ORPCError } from "@orpc/client";
import { getPaymentCardById } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getAttachment as getGmailAttachment } from "../../mailboxes/lib/gmail-client";
import { getImapAttachmentContent } from "../../mailboxes/lib/imap-provider";
import { getOutlookAttachment } from "../../mailboxes/lib/outlook-client";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";

/**
 * Fetches one attachment's content live from the provider (not stored
 * locally) and returns it base64-encoded for the client to save/preview.
 * Ownership is enforced via the payment card, mirroring get-card.ts, so a
 * user can only ever download an attachment belonging to their own mailbox.
 */
export const getAttachment = protectedProcedure
	.route({
		method: "GET",
		path: "/payment-tracking/cards/{id}/attachments/{attachmentId}",
		tags: ["Payment Tracking"],
		summary: "Download a payment card's email attachment",
	})
	.input(z.object({ id: z.string(), attachmentId: z.string() }))
	.handler(async ({ input, context }) => {
		const card = await getPaymentCardById(input.id, context.user.id);
		if (!card) {
			throw new ORPCError("NOT_FOUND");
		}

		const mailbox = await verifyMailboxOwnership(
			card.mailboxId,
			context.user.id,
		);

		if (mailbox.provider === "GOOGLE") {
			const attachment = await getGmailAttachment(
				mailbox.accountId,
				card.emailId,
				input.attachmentId,
			);
			if (!attachment.data) {
				throw new ORPCError("NOT_FOUND", {
					message: "Attachment content is unavailable.",
				});
			}
			// Gmail returns base64url — convert to standard base64 for the client.
			const base64 = attachment.data
				.replace(/-/g, "+")
				.replace(/_/g, "/");
			return { base64Data: base64 };
		}

		if (mailbox.provider === "IMAP") {
			const attachment = await getImapAttachmentContent(
				mailbox.accountId,
				card.emailId,
				input.attachmentId,
			);
			if (!attachment) {
				throw new ORPCError("NOT_FOUND", {
					message: "Attachment content is unavailable.",
				});
			}
			return { base64Data: attachment.content.toString("base64") };
		}

		const attachment = await getOutlookAttachment(
			mailbox.accountId,
			card.emailId,
			input.attachmentId,
		);
		if (!attachment.contentBytes) {
			throw new ORPCError("NOT_FOUND", {
				message: "Attachment content is unavailable.",
			});
		}
		return { base64Data: attachment.contentBytes };
	});
