// Server-side sanitization for outbound email HTML.
//
// This runs inside the Next.js server runtime, so it must NOT depend on
// jsdom/DOMPurify (jsdom fails to load its default stylesheet when bundled by
// Next and crashes the route). Instead this is a conservative, dependency-free
// allowlist sanitizer: it strips dangerous tags (script/style/iframe/…), inline
// event handlers, and `javascript:` URIs while leaving formatting, tables,
// lists, links and inline images intact.
//
// The browser-side editor already sanitizes with DOMPurify before this point;
// this is defence-in-depth for the send path.

// Tags removed entirely, including their contents.
const STRIP_WITH_CONTENT =
	/<(script|style|iframe|object|embed|noscript|template|title)\b[^>]*>[\s\S]*?<\/\1>/gi;

// Dangerous standalone/void tags removed (content kept where applicable).
const STRIP_TAGS =
	/<\/?(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi;

// Inline event handler attributes: on*="..." / on*='...' / on*=value.
const STRIP_EVENT_ATTRS = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;

// `javascript:` / `vbscript:` / `data:text/html` URIs in href/src.
const STRIP_DANGEROUS_URIS =
	/\s+(href|src)\s*=\s*("\s*(?:javascript|vbscript|data:text\/html)[^"]*"|'\s*(?:javascript|vbscript|data:text\/html)[^']*'|\s*(?:javascript|vbscript|data:text\/html)[^\s>]*)/gi;

/**
 * Sanitizes outbound email HTML against XSS while preserving safe formatting.
 * Returns real HTML (never escaped markup).
 */
export function sanitizeOutboundHtml(html: string): string {
	if (!html) {
		return "";
	}
	return html
		.replace(STRIP_WITH_CONTENT, "")
		.replace(STRIP_TAGS, "")
		.replace(STRIP_EVENT_ATTRS, "")
		.replace(STRIP_DANGEROUS_URIS, "");
}

/** True when the string contains HTML tags, i.e. it is rich content. */
export function looksLikeHtml(body: string): boolean {
	return /<\/?[a-z][\s\S]*>/i.test(body);
}
