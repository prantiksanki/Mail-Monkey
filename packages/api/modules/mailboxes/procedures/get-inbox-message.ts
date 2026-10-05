import { getEmailById } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { parseGmailMessage } from "../lib/email-parser";
import { getMessage } from "../lib/gmail-client";
import { getOutlookMessage } from "../lib/outlook-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const getInboxMessage = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/inbox/{messageId}",
		tags: ["Mailboxes"],
		summary: "Get full email message",
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

		// Try local DB first — fast and avoids Gmail quota
		const local = await getEmailById(mailbox.id, input.messageId);
		if (local) {
			return {
				id: local.id,
				threadId: local.threadId,
				from: local.from,
				fromEmail: local.fromEmail,
				to: local.to,
				toEmail: local.fromEmail, // approximate; toEmail not stored separately
				subject: local.subject,
				snippet: local.snippet,
				bodyText: local.bodyText,
				bodyHtml: local.bodyHtml,
				date: local.internalDate.toISOString(),
				labelIds: local.labelIds,
				isUnread: local.isUnread,
				headers: {},
			};
		}

		// Fallback: fetch live from Outlook Graph API
		if (mailbox.provider === "OUTLOOK") {
			const msg = await getOutlookMessage(
				mailbox.accountId,
				input.messageId,
			);

			const fromName =
				msg.from?.emailAddress?.name ??
				msg.from?.emailAddress?.address ??
				"";
			const fromEmail = msg.from?.emailAddress?.address ?? fromName;
			const toRecipient = msg.toRecipients?.[0];
			const to =
				toRecipient?.emailAddress?.name ??
				toRecipient?.emailAddress?.address ??
				"";
			const toEmail = toRecipient?.emailAddress?.address ?? "";

			const isHtml = msg.body?.contentType?.toLowerCase() === "html";
			const bodyHtml = isHtml ? (msg.body?.content ?? "") : "";
			const bodyText = isHtml ? "" : (msg.body?.content ?? "");

			const headers: Record<string, string> = {};
			for (const h of msg.internetMessageHeaders ?? []) {
				headers[h.name.toLowerCase()] = h.value;
			}

			return {
				id: msg.id,
				threadId: msg.conversationId ?? "",
				from: fromName,
				fromEmail,
				to,
				toEmail,
				subject: msg.subject ?? "(No subject)",
				snippet: msg.bodyPreview ?? "",
				bodyText,
				bodyHtml,
				date: msg.receivedDateTime,
				labelIds: msg.categories ?? [],
				isUnread: !msg.isRead,
				headers,
			};
		}

		// Fallback: fetch from Gmail (e.g. during initial sync or for scheduled/snoozed)
		const msg = await getMessage(
			mailbox.accountId,
			input.messageId,
			"full",
		);

		const parsed = parseGmailMessage(
			msg as Parameters<typeof parseGmailMessage>[0],
		);

		return {
			...parsed,
			date: parsed.date.toISOString(),
			isUnread: (msg.labelIds ?? []).includes("UNREAD"),
			labelIds: msg.labelIds ?? [],
		};
	});
