import { sendMessage } from "./gmail-client";
import { sendImapEmail } from "./imap-provider";
import { sendOutlookMessage } from "./outlook-client";
import { looksLikeHtml, sanitizeOutboundHtml } from "./sanitize-html";

/** RFC 2045 base64 encoding for a body part (76-char lines). */
function base64Body(body: string): string {
	return Buffer.from(body, "utf-8")
		.toString("base64")
		.replace(/(.{76})/g, "$1\r\n");
}

/** Strips tags to produce a readable plain-text alternative from HTML. */
export function htmlToPlainText(html: string): string {
	return html
		.replace(/<\s*br\s*\/?>/gi, "\n")
		.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
}

function commonHeaders(
	from: string,
	to: string,
	subject: string,
	extra?: { cc?: string | null; bcc?: string | null },
): string[] {
	const headers = [`From: ${from}`, `To: ${to}`, `Subject: ${subject}`];
	if (extra?.cc) {
		headers.push(`Cc: ${extra.cc}`);
	}
	if (extra?.bcc) {
		headers.push(`Bcc: ${extra.bcc}`);
	}
	headers.push("MIME-Version: 1.0");
	return headers;
}

function base64Url(raw: string): string {
	return Buffer.from(raw)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** Plain-text only message (used when the body has no HTML). */
function encodePlainText(
	from: string,
	to: string,
	subject: string,
	body: string,
	extra?: { cc?: string | null; bcc?: string | null },
): string {
	const headers = [
		...commonHeaders(from, to, subject, extra),
		'Content-Type: text/plain; charset="UTF-8"',
	];
	return base64Url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}

/**
 * multipart/alternative message carrying both a text/plain fallback and the
 * sanitized text/html part — so clients render the rich content (preserving
 * forwarded formatting) while non-HTML clients still get readable text.
 */
function encodeHtml(
	from: string,
	to: string,
	subject: string,
	html: string,
	extra?: { cc?: string | null; bcc?: string | null },
): string {
	const boundary = `zm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
	const plain = htmlToPlainText(html) || " ";

	const headers = [
		...commonHeaders(from, to, subject, extra),
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
	];

	const parts = [
		`--${boundary}`,
		'Content-Type: text/plain; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
		"",
		base64Body(plain),
		`--${boundary}`,
		'Content-Type: text/html; charset="UTF-8"',
		"Content-Transfer-Encoding: base64",
		"",
		base64Body(html),
		`--${boundary}--`,
	];

	return base64Url(`${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}`);
}

export interface SendEmailInput {
	accountId: string;
	from: string;
	to: string;
	cc?: string | null;
	bcc?: string | null;
	subject: string;
	body: string;
}

/**
 * Encodes and sends an email through the mailbox's Gmail account, rendering
 * HTML bodies as a sanitized multipart/alternative message and plain-text
 * bodies as text/plain. Shared by the interactive send procedure and the
 * scheduled-send cron worker so both get identical HTML support.
 */
export async function sendEmailViaGmail(input: SendEmailInput) {
	const extra = { cc: input.cc, bcc: input.bcc };
	const raw = looksLikeHtml(input.body)
		? encodeHtml(
				input.from,
				input.to,
				input.subject,
				// Defence-in-depth: re-sanitize on the server before sending.
				sanitizeOutboundHtml(input.body),
				extra,
			)
		: encodePlainText(
				input.from,
				input.to,
				input.subject,
				input.body,
				extra,
			);

	const result = await sendMessage(input.accountId, raw);
	return { messageId: result.id ?? null };
}

export type SendProvider = "GOOGLE" | "OUTLOOK" | "IMAP";

/**
 * Sends through whichever provider backs the mailbox (Gmail API, Microsoft
 * Graph, or the account's SMTP server). Gmail-only `sendEmailViaGmail` silently
 * fails for Outlook/IMAP accounts, so mailbox-level callers use this instead.
 */
export async function sendEmailForMailbox(
	provider: SendProvider,
	input: SendEmailInput,
): Promise<{ messageId: string | null }> {
	if (provider === "GOOGLE") {
		return sendEmailViaGmail(input);
	}

	const isHtml = looksLikeHtml(input.body);
	const body = isHtml ? sanitizeOutboundHtml(input.body) : input.body;

	if (provider === "OUTLOOK") {
		await sendOutlookMessage(input.accountId, {
			to: input.to,
			cc: input.cc ?? undefined,
			bcc: input.bcc ?? undefined,
			subject: input.subject,
			body,
			isHtml,
		});
		// Graph's sendMail returns 202 with no message id.
		return { messageId: null };
	}

	return sendImapEmail(input.accountId, {
		from: input.from,
		to: input.to,
		cc: input.cc,
		bcc: input.bcc,
		subject: input.subject,
		text: isHtml ? htmlToPlainText(body) || " " : body,
		html: isHtml ? body : undefined,
	});
}
