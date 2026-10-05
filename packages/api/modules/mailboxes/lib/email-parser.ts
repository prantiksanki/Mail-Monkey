// Local interfaces matching Gmail API response shape.
// gmail-client.ts returns untyped `res.data`, so we define the structure here.

interface GmailHeader {
	name: string;
	value: string;
}

interface GmailBody {
	data?: string;
	size: number;
}

interface GmailMessagePart {
	mimeType: string;
	body?: GmailBody;
	parts?: GmailMessagePart[];
	headers?: GmailHeader[];
}

export interface GmailMessage {
	id: string;
	threadId: string;
	snippet: string;
	internalDate: string;
	labelIds: string[];
	payload: {
		mimeType?: string;
		headers: GmailHeader[];
		body?: GmailBody;
		parts?: GmailMessagePart[];
	};
}

export interface ParsedEmail {
	id: string;
	threadId: string;
	from: string;
	fromEmail: string;
	to: string;
	toEmail: string;
	subject: string;
	snippet: string;
	bodyText: string;
	bodyHtml: string;
	date: Date;
	labelIds: string[];
	headers: Record<string, string>;
}

function getHeader(headers: GmailHeader[], name: string): string {
	return (
		headers.find((h) => h.name.toLowerCase() === name.toLowerCase())
			?.value ?? ""
	);
}

function decodeHtmlEntities(text: string): string {
	return text
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&apos;/g, "'")
		.replace(/&nbsp;/g, " ")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
			String.fromCharCode(Number.parseInt(hex, 16)),
		);
}

function extractEmail(headerValue: string): string {
	const match = headerValue.match(/<([^>]+)>/);
	return (match ? match[1] : headerValue).toLowerCase().trim();
}

function decodeBase64Url(data: string): string {
	return Buffer.from(
		data.replace(/-/g, "+").replace(/_/g, "/"),
		"base64",
	).toString("utf-8");
}

function findBodyPart(parts: GmailMessagePart[], mimeType: string): string {
	for (const part of parts) {
		if (part.mimeType === mimeType && part.body?.data) {
			return decodeBase64Url(part.body.data);
		}
		if (part.parts) {
			const nested = findBodyPart(part.parts, mimeType);
			if (nested) {
				return nested;
			}
		}
	}
	return "";
}

export function parseGmailMessage(message: GmailMessage): ParsedEmail {
	const headers = message.payload.headers ?? [];
	const fromHeader = getHeader(headers, "From");
	const toHeader = getHeader(headers, "To");

	let bodyText = "";
	let bodyHtml = "";
	if (message.payload.parts) {
		bodyText = findBodyPart(message.payload.parts, "text/plain");
		bodyHtml = findBodyPart(message.payload.parts, "text/html");
	} else if (message.payload.body?.data) {
		const decoded = decodeBase64Url(message.payload.body.data);
		if (message.payload.mimeType === "text/html") {
			bodyHtml = decoded;
		} else {
			bodyText = decoded;
		}
	}

	const headersMap: Record<string, string> = {};
	for (const h of headers) {
		headersMap[h.name.toLowerCase()] = h.value;
	}

	return {
		id: message.id,
		threadId: message.threadId,
		from: fromHeader,
		fromEmail: extractEmail(fromHeader),
		to: toHeader,
		toEmail: extractEmail(toHeader),
		subject: decodeHtmlEntities(getHeader(headers, "Subject")),
		snippet: decodeHtmlEntities(message.snippet),
		bodyText,
		bodyHtml,
		date: new Date(Number(message.internalDate)),
		labelIds: message.labelIds,
		headers: headersMap,
	};
}
