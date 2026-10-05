import type { ParsedEmail } from "./email-parser";
import type { GraphMessage } from "./outlook-client";

function _extractEmail(value: string): string {
	const match = value.match(/<([^>]+)>/);
	return (match ? match[1] : value).toLowerCase().trim();
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
		labelIds: [],
		headers,
	};
}
