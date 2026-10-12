import { ORPCError } from "@orpc/client";
import { getEmailById, getPaymentCardById } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { parseGmailMessage } from "../../mailboxes/lib/email-parser";
import { getMessage } from "../../mailboxes/lib/gmail-client";
import { imapProvider } from "../../mailboxes/lib/imap-provider";
import {
	getOutlookMessage,
	listOutlookAttachments,
} from "../../mailboxes/lib/outlook-client";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";
import type { PaymentCardAttachment, PaymentCardDetail } from "../types";

/**
 * Attachment metadata isn't stored locally (Email rows only keep the parsed
 * body) — fetched live on each card open, same as the rest of this app fetches
 * live message data. A failure here must never break the detail view; the
 * email itself (already loaded from the DB) is still shown without its
 * attachment list.
 */
async function fetchAttachments(
	provider: "GOOGLE" | "OUTLOOK" | "IMAP",
	accountId: string,
	messageId: string,
): Promise<PaymentCardAttachment[]> {
	try {
		if (provider === "GOOGLE") {
			const msg = await getMessage(accountId, messageId, "full");
			const parsed = parseGmailMessage(
				msg as Parameters<typeof parseGmailMessage>[0],
			);
			return parsed.attachments;
		}

		if (provider === "IMAP") {
			const parsed = await imapProvider.getParsedMessage(
				accountId,
				messageId,
			);
			return parsed.attachments;
		}

		const msg = await getOutlookMessage(accountId, messageId);
		if (!msg.hasAttachments) {
			return [];
		}
		const attachments = await listOutlookAttachments(accountId, messageId);
		return attachments.map((a) => ({
			attachmentId: a.id,
			filename: a.name,
			mimeType: a.contentType,
			size: a.size,
		}));
	} catch (error) {
		logger.warn("[payment-tracking] Failed to fetch attachment list", {
			provider,
			messageId,
			error: error instanceof Error ? error.message : String(error),
		});
		return [];
	}
}

export const getCard = protectedProcedure
	.route({
		method: "GET",
		path: "/payment-tracking/cards/{id}",
		tags: ["Payment Tracking"],
		summary:
			"Get full payment card detail, including the source email body",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input, context }) => {
		const card = await getPaymentCardById(input.id, context.user.id);
		if (!card) {
			throw new ORPCError("NOT_FOUND");
		}

		// Defense in depth — getPaymentCardById already scopes by userId, but
		// this also validates the mailbox itself is still owned by this user.
		const mailbox = await verifyMailboxOwnership(
			card.mailboxId,
			context.user.id,
		);

		const email = await getEmailById(card.mailboxId, card.emailId);
		if (!email) {
			throw new ORPCError("NOT_FOUND", {
				message:
					"The source email for this payment card is no longer available.",
			});
		}

		const attachments = await fetchAttachments(
			mailbox.provider,
			mailbox.accountId,
			card.emailId,
		);

		const detail: PaymentCardDetail = {
			id: card.id,
			mailboxId: card.mailboxId,
			provider: mailbox.provider,
			mailboxEmail: mailbox.email,
			emailId: card.emailId,
			threadId: card.threadId,
			subject: email.subject,
			from: email.from,
			fromEmail: email.fromEmail,
			to: email.to,
			receivedAt: email.internalDate.toISOString(),
			paymentType: card.paymentType,
			merchant: card.merchant,
			amount: card.amount,
			currency: card.currency,
			dueDate: card.dueDate ? card.dueDate.toISOString() : null,
			paymentStatus: card.paymentStatus,
			confidence: card.confidence,
			kanbanStatus: card.kanbanStatus,
			statusSource: card.statusSource,
			bodyText: email.bodyText,
			bodyHtml: email.bodyHtml,
			attachments,
		};

		return detail;
	});
