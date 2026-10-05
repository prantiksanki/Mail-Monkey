import { looksLikeHtml } from "./sanitize-html";

export interface Rfc2822Fields {
	from: string;
	to?: string;
	cc?: string;
	bcc?: string;
	subject?: string;
	body?: string;
}

function base64Url(raw: string): string {
	return Buffer.from(raw)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

/** RFC 2045 base64 body encoding (76-char lines). */
function base64Body(body: string): string {
	return Buffer.from(body, "utf-8")
		.toString("base64")
		.replace(/(.{76})/g, "$1\r\n");
}

/**
 * Builds a base64url-encoded RFC 2822 message for the Gmail send/draft APIs.
 * Recipient/subject/body are optional so an in-progress draft can be encoded
 * with whatever the user has typed so far. HTML bodies are written as a
 * `text/html` part so they round-trip as rich content (not raw markup); plain
 * bodies stay `text/plain`.
 */
export function encodeRfc2822(fields: Rfc2822Fields): string {
	const headers = [`From: ${fields.from}`];
	if (fields.to) {
		headers.push(`To: ${fields.to}`);
	}
	if (fields.cc) {
		headers.push(`Cc: ${fields.cc}`);
	}
	if (fields.bcc) {
		headers.push(`Bcc: ${fields.bcc}`);
	}
	headers.push(`Subject: ${fields.subject ?? ""}`);
	headers.push("MIME-Version: 1.0");

	const body = fields.body ?? "";
	if (looksLikeHtml(body)) {
		headers.push('Content-Type: text/html; charset="UTF-8"');
		headers.push("Content-Transfer-Encoding: base64");
		return base64Url(`${headers.join("\r\n")}\r\n\r\n${base64Body(body)}`);
	}

	headers.push('Content-Type: text/plain; charset="UTF-8"');
	return base64Url(`${headers.join("\r\n")}\r\n\r\n${body}`);
}
