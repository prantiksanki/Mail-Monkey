import { simpleParser } from "mailparser";
import type { ParsedEmail } from "./email-parser";

/** IMAP system flags that map to the ParsedEmail.labelIds vocabulary Gmail/Outlook already use. */
const FLAG_LABEL: Record<string, string> = {
	"\\Seen": "SEEN",
	"\\Flagged": "STARRED",
	"\\Answered": "ANSWERED",
};

function flagsToLabelIds(flags: Iterable<string>): string[] {
	const ids: string[] = [];
	for (const flag of flags) {
		const label = FLAG_LABEL[flag];
		if (label) {
			ids.push(label);
		}
	}
	return ids;
}

/**
 * Best-effort thread grouping: generic IMAP has no native thread ID (unlike
 * Gmail's threadId or Outlook's conversationId), so we derive one from the
 * standard RFC 5322 References/In-Reply-To chain — the oldest ancestor in
 * References is the thread root, falling back to In-Reply-To, then the
 * message's own Message-ID for a message with no ancestors.
 */
function deriveThreadId(headers: {
	messageId?: string;
	references?: string | string[];
	inReplyTo?: string | string[];
}): string {
	const references = Array.isArray(headers.references)
		? headers.references
		: headers.references
			? [headers.references]
			: [];
	if (references.length > 0) {
		return references[0];
	}
	const inReplyTo = Array.isArray(headers.inReplyTo)
		? headers.inReplyTo[0]
		: headers.inReplyTo;
	if (inReplyTo) {
		return inReplyTo;
	}
	return headers.messageId ?? "";
}

export interface ImapMessageSource {
	uid: number;
	flags: Set<string>;
	source: Buffer;
}

export async function parseImapMessage(
	msg: ImapMessageSource,
): Promise<ParsedEmail> {
	const parsed = await simpleParser(msg.source);

	const from = parsed.from?.text ?? "";
	const fromEmail = parsed.from?.value[0]?.address?.toLowerCase() ?? from;
	const to = parsed.to
		? Array.isArray(parsed.to)
			? parsed.to.map((a) => a.text).join(", ")
			: parsed.to.text
		: "";
	const toEmail =
		(Array.isArray(parsed.to)
			? parsed.to[0]?.value[0]?.address
			: parsed.to?.value[0]?.address
		)?.toLowerCase() ?? to;

	const headers: Record<string, string> = {};
	for (const [key, value] of parsed.headers) {
		headers[key.toLowerCase()] =
			typeof value === "string" ? value : JSON.stringify(value);
	}

	const id = String(msg.uid);

	return {
		id,
		threadId: deriveThreadId({
			messageId: parsed.messageId,
			references: parsed.references,
			inReplyTo: parsed.inReplyTo,
		}),
		from,
		fromEmail,
		to,
		toEmail,
		subject: parsed.subject ?? "(No subject)",
		snippet: (parsed.text ?? "").slice(0, 200),
		bodyText: parsed.text ?? "",
		bodyHtml: typeof parsed.html === "string" ? parsed.html : "",
		date: parsed.date ?? new Date(),
		labelIds: flagsToLabelIds(msg.flags),
		headers,
		attachments: parsed.attachments.map((a) => ({
			attachmentId: a.contentId ?? a.filename ?? a.checksum,
			filename: a.filename ?? "attachment",
			mimeType: a.contentType,
			size: a.size,
		})),
	};
}

export function isUnreadFromFlags(flags: Iterable<string>): boolean {
	for (const flag of flags) {
		if (flag === "\\Seen") {
			return false;
		}
	}
	return true;
}
