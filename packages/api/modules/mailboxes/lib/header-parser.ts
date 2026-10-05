// Parses raw email headers (IMAP/MIME / Gmail / Graph) into the Gmail-style
// "sender details" metadata shown in the email view popup.
//
// Input is a case-insensitive map of raw header name -> value, as produced by
// `parseGmailMessage` (Gmail payload headers) or the Outlook
// `internetMessageHeaders` array. This module is pure so it can be unit tested
// without a live provider.

export interface EmailSecurityInfo {
	/** True when TLS was used for the last hop, derived from Received headers. */
	encrypted: boolean;
	/** Human-readable label, e.g. "Standard encryption (TLS)". */
	label: string;
	/** TLS version / cipher detail if present in the Received header. */
	tls?: string;
}

export interface AuthenticationInfo {
	/** SPF result: pass | fail | softfail | neutral | none | undefined. */
	spf?: string;
	/** DKIM result: pass | fail | none | undefined. */
	dkim?: string;
	/** DMARC result: pass | fail | none | undefined. */
	dmarc?: string;
}

export interface ParsedEmailHeaders {
	from: string;
	fromEmail: string;
	to: string;
	cc?: string;
	bcc?: string;
	replyTo?: string;
	subject: string;
	/** ISO date string, or empty when no Date header is present. */
	date: string;
	/** Sending domain (envelope / Return-Path / mailed-by). */
	mailedBy?: string;
	/** DKIM signing domain (d= tag), i.e. "signed-by". */
	signedBy?: string;
	security: EmailSecurityInfo;
	authentication: AuthenticationInfo;
}

/** Case-insensitive header lookup against a pre-lowercased-key map. */
function get(headers: Record<string, string>, name: string): string {
	return headers[name.toLowerCase()] ?? "";
}

/** Extracts the address portion of a header value like `Name <a@b.com>`. */
function extractEmail(value: string): string {
	const match = value.match(/<([^>]+)>/);
	return (match ? match[1] : value).trim().toLowerCase();
}

/** Extracts the bare domain from an email address or domain-ish string. */
function domainOf(value: string): string {
	const email = extractEmail(value);
	const at = email.lastIndexOf("@");
	return at >= 0 ? email.slice(at + 1) : email;
}

/**
 * Parses an `Authentication-Results` header into spf/dkim/dmarc verdicts.
 * Example: "mx.google.com; spf=pass ...; dkim=pass header.i=@openai.com; dmarc=pass ..."
 */
function parseAuthenticationResults(value: string): AuthenticationInfo {
	const result: AuthenticationInfo = {};
	if (!value) {
		return result;
	}
	const grab = (method: string): string | undefined => {
		const m = value.match(new RegExp(`\\b${method}=([a-z]+)`, "i"));
		return m ? m[1].toLowerCase() : undefined;
	};
	result.spf = grab("spf");
	result.dkim = grab("dkim");
	result.dmarc = grab("dmarc");
	return result;
}

/** Pulls the DKIM signing domain from a `DKIM-Signature` header's `d=` tag. */
function dkimDomain(dkimSignature: string): string | undefined {
	const m = dkimSignature.match(/\bd=([^;\s]+)/i);
	return m ? m[1].trim().toLowerCase() : undefined;
}

/**
 * Derives TLS/encryption status from the topmost `Received` header.
 * Most MTAs append `(using TLSv1.3 ...)` or `with ESMTPS` for encrypted hops.
 */
function parseSecurity(received: string): EmailSecurityInfo {
	if (!received) {
		return { encrypted: false, label: "No encryption information" };
	}
	const tlsMatch = received.match(/\b(TLSv?[0-9.]+)\b/i);
	const encrypted =
		/\bwith\s+E?SMTPS\b/i.test(received) ||
		/\busing\s+TLS/i.test(received) ||
		tlsMatch != null;

	if (encrypted) {
		return {
			encrypted: true,
			label: "Standard encryption (TLS)",
			tls: tlsMatch ? tlsMatch[1] : undefined,
		};
	}
	return { encrypted: false, label: "No encryption (standard)" };
}

/**
 * Parses a raw header map into the structured metadata for the sender popup.
 * Missing headers are handled gracefully — optional fields are simply omitted.
 */
export function parseEmailHeaders(
	headers: Record<string, string>,
): ParsedEmailHeaders {
	// Normalise keys to lowercase so lookups are case-insensitive regardless of
	// how the provider cased them.
	const lower: Record<string, string> = {};
	for (const [key, value] of Object.entries(headers)) {
		lower[key.toLowerCase()] = value;
	}

	const from = get(lower, "from");
	const replyTo = get(lower, "reply-to");
	const returnPath = get(lower, "return-path");
	const dkimSignature = get(lower, "dkim-signature");
	const authResults =
		get(lower, "authentication-results") ||
		get(lower, "arc-authentication-results");
	const received = get(lower, "received") || get(lower, "x-received") || "";
	const dateHeader = get(lower, "date");

	const authentication = parseAuthenticationResults(authResults);

	const mailedBy = returnPath ? domainOf(returnPath) : domainOf(from);
	const signedBy =
		dkimDomain(dkimSignature) ||
		(authentication.dkim === "pass" ? domainOf(from) : undefined);

	let date = "";
	if (dateHeader) {
		const parsed = new Date(dateHeader);
		if (!Number.isNaN(parsed.getTime())) {
			date = parsed.toISOString();
		}
	}

	return {
		from,
		fromEmail: extractEmail(from),
		to: get(lower, "to"),
		cc: get(lower, "cc") || undefined,
		bcc: get(lower, "bcc") || undefined,
		replyTo: replyTo || undefined,
		subject: get(lower, "subject"),
		date,
		mailedBy: mailedBy || undefined,
		signedBy,
		security: parseSecurity(received),
		authentication,
	};
}
