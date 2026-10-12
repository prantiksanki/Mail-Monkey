import type { ParsedEmail } from "./email-parser";
import type { GraphMessage } from "./outlook-client";

function _extractEmail(value: string): string {
	const match = value.match(/<([^>]+)>/);
	return (match ? match[1] : value).toLowerCase().trim();
}

/**
 * Builds the local labelIds mirror for an Outlook message. Every message this
 * parser ever sees comes from the inbox folder (both the webhook subscription
 * and listOutlookInboxMessages are scoped to /me/mailFolders/inbox), so INBOX
 * is always present — without it, INBOX-scoped queries like countUnreadInbox
 * silently return 0 for every Outlook mailbox. IMPORTANT mirrors Graph's own
 * `importance: "high"` as the cross-provider Priority signal (Gmail already
 * stores its own IMPORTANT system label the same way).
 */
function buildOutlookLabelIds(msg: GraphMessage): string[] {
	const labelIds = ["INBOX"];
	if (msg.importance === "high") {
		labelIds.push("IMPORTANT");
	}
	return labelIds;
}

export function parseOutlookMessage(msg: GraphMessage): ParsedEmail {
	const fromAddr = msg.from?.emailAddress?.address ?? "";
	const fromName = msg.from?.emailAddress?.name ?? "";
	const from = fromName ? `${fromName} <${fromAddr}>` : fromAddr;

	const toRecipient = msg.toRecipients?.[0]?.emailAddress;
	const toAddr = toRecipient?.address ?? "";
	const toName = toRecipient?.name ?? "";
	const to = toName ? `${toName} <${toAddr}>` : toAddr;

	const bodyContent = msg.body?.content ?? "";
	const isHtml = msg.body?.contentType?.toLowerCase() === "html";

	const headers: Record<string, string> = {};
	for (const h of msg.internetMessageHeaders ?? []) {
		headers[h.name.toLowerCase()] = h.value;
	}

	return {
		id: msg.id,
		threadId: msg.conversationId,
		from,
		fromEmail: fromAddr.toLowerCase(),
		to,
		toEmail: toAddr.toLowerCase(),
		subject: msg.subject ?? "",
		snippet: msg.bodyPreview ?? "",
		bodyText: isHtml ? "" : bodyContent,
		bodyHtml: isHtml ? bodyContent : "",
		date: new Date(msg.receivedDateTime),
		labelIds: buildOutlookLabelIds(msg),
		headers,
		// Graph doesn't embed attachment metadata in the message payload (unlike
		// Gmail) — only a hasAttachments flag. Callers that need the real list
		// (payment-tracking get-card.ts) fetch it separately via
		// listOutlookAttachments when msg.hasAttachments is true.
		attachments: [],
	};
}
