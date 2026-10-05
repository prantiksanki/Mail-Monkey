import DOMPurify from "dompurify";

// Tags/attributes that are safe to keep so forwarded email renders visually like
// the original — formatting, tables, lists, links, inline images and inline
// styles are preserved while scripts/handlers/iframes are stripped.
const ALLOWED_TAGS = [
	"a",
	"b",
	"blockquote",
	"br",
	"caption",
	"code",
	"col",
	"colgroup",
	"div",
	"em",
	"font",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"hr",
	"i",
	"img",
	"li",
	"ol",
	"p",
	"pre",
	"q",
	"s",
	"small",
	"span",
	"strike",
	"strong",
	"sub",
	"sup",
	"table",
	"tbody",
	"td",
	"tfoot",
	"th",
	"thead",
	"tr",
	"u",
	"ul",
];

const ALLOWED_ATTR = [
	"href",
	"src",
	"alt",
	"title",
	"width",
	"height",
	"align",
	"valign",
	"bgcolor",
	"color",
	"face",
	"size",
	"border",
	"cellpadding",
	"cellspacing",
	"colspan",
	"rowspan",
	"style",
	"dir",
	"target",
	"rel",
];

const SANITIZE_CONFIG = {
	ALLOWED_TAGS,
	ALLOWED_ATTR,
	// Allow data: and cid: image URIs (inline images) plus normal links.
	ALLOW_DATA_ATTR: false,
	ADD_ATTR: ["target"],
	FORBID_TAGS: [
		"script",
		"style",
		"iframe",
		"object",
		"embed",
		"form",
		"link",
	],
	FORBID_ATTR: ["onerror", "onload", "onclick"],
};

// Server-safe fallback used during SSR, where DOMPurify has no DOM to work
// with. Conservatively strips dangerous tags, inline handlers and javascript:
// URIs. The browser re-sanitizes with DOMPurify before anything is rendered.
function fallbackStrip(html: string): string {
	return html
		.replace(
			/<(script|style|iframe|object|embed|noscript|template|title)\b[^>]*>[\s\S]*?<\/\1>/gi,
			"",
		)
		.replace(
			/<\/?(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi,
			"",
		)
		.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
		.replace(
			/\s+(href|src)\s*=\s*("\s*(?:javascript|vbscript)[^"]*"|'\s*(?:javascript|vbscript)[^']*'|\s*(?:javascript|vbscript)[^\s>]*)/gi,
			"",
		);
}

/**
 * Sanitizes email HTML for safe rendering inside the compose editor. Preserves
 * formatting, tables, lists, links and inline images; removes scripts, event
 * handlers and other XSS vectors. Never returns escaped markup — the result is
 * real DOM-ready HTML.
 */
export function sanitizeEmailHtml(html: string): string {
	if (!html) {
		return "";
	}
	// DOMPurify needs a DOM; during SSR fall back to a regex strip. The editor
	// only renders client-side, so the browser always re-sanitizes properly.
	const clean =
		typeof window === "undefined"
			? fallbackStrip(html)
			: DOMPurify.sanitize(html, SANITIZE_CONFIG);
	// Force external links to open safely in a new tab.
	return clean.replace(
		/<a\s/gi,
		'<a target="_blank" rel="noopener noreferrer nofollow" ',
	);
}

/** Escapes plain text into HTML, preserving line breaks. */
export function plainTextToHtml(text: string): string {
	const escaped = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
	return escaped.replace(/\r?\n/g, "<br>");
}

interface ForwardSource {
	from: string;
	to: string;
	date: string;
	subject: string;
	/** Sanitized HTML body, when the original had a text/html part. */
	bodyHtml?: string;
	/** Plain-text body, used only when no HTML part exists. */
	bodyText?: string;
}

function formatForwardDate(iso: string): string {
	try {
		return new Date(iso).toLocaleString([], {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return iso;
	}
}

/**
 * Builds the Gmail-style forwarded message block as ready-to-render HTML:
 * an empty line for the user's note, the "---------- Forwarded message
 * ----------" separator with headers, then the original body quoted inside a
 * left-bordered container (Gmail's `gmail_quote` structure).
 *
 * Prefers the original `text/html` body and only falls back to escaped
 * `text/plain` when no HTML part is available.
 */
export function buildForwardHtml(source: ForwardSource): string {
	const bodyHtml = source.bodyHtml
		? sanitizeEmailHtml(source.bodyHtml)
		: source.bodyText
			? plainTextToHtml(source.bodyText)
			: "<p>(No content)</p>";

	const headerLines = [
		`<b>From:</b> ${plainTextToHtml(source.from)}`,
		`<b>Date:</b> ${plainTextToHtml(formatForwardDate(source.date))}`,
		`<b>Subject:</b> ${plainTextToHtml(source.subject)}`,
		`<b>To:</b> ${plainTextToHtml(source.to)}`,
	].join("<br>");

	return [
		"<p><br></p>",
		'<div class="gmail_quote">',
		'<div dir="ltr" class="gmail_attr">---------- Forwarded message ----------<br>',
		headerLines,
		"</div>",
		"<br>",
		`<div class="forwarded-body">${bodyHtml}</div>`,
		"</div>",
	].join("");
}
