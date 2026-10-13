import DOMPurify from "dompurify";

// Tags/attributes that are safe to keep so forwarded email renders visually like
// the original — formatting, tables, lists, links, inline images and inline
// styles are preserved while scripts/handlers/iframes are stripped.
const ALLOWED_TAGS = [
	"a",
	"b",
	"blockquote",
	"br",
	"address",
	"article",
	"caption",
	"center",
	"code",
	"col",
	"colgroup",
	"div",
	"em",
	"figcaption",
	"figure",
	"font",
	"footer",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hr",
	"i",
	"img",
	"li",
	"ol",
	"p",
	"picture",
	"pre",
	"q",
	"s",
	"section",
	"small",
	"source",
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
	"class",
	"srcset",
	"sizes",
	"media",
	"background",
	"nowrap",
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

// Email layouts (e.g. GitHub notifications) are styled by <style> blocks,
// usually in <head>, that DOMPurify would drop. Keep their CSS for the
// sandboxed srcDoc iframe only (no scripts run there): remove any markup,
// @import and legacy script-in-CSS constructs so it stays plain CSS.
function extractEmailCss(html: string): string {
	const blocks = html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) ?? [];
	return blocks
		.map((block) =>
			block
				.replace(/^<style\b[^>]*>/i, "")
				.replace(/<\/style>$/i, "")
				.replace(/<\/?[a-z][^>]*>/gi, "")
				.replace(/@import[^;]*;?/gi, "")
				.replace(/expression\s*\(/gi, "")
				.replace(/(java|vb)script:/gi, ""),
		)
		.join("\n");
}

// Wraps raw email HTML in a self-contained, sandboxed document. Module-level
// and pure so the output is referentially stable when memoized by the caller.
// Shared by InboxPage's message detail view and the Payments card detail view
// — both render a received email the same safe way: DOMPurify sanitization
// (sanitizeEmailHtml) as the primary defense, plus srcDoc + a sandboxed
// iframe (no allow-scripts) + CSP script-src 'none' as defense-in-depth.
export function buildEmailSrcDoc(html: string): string {
	// Strip cid: images (inline attachments not fetched) to avoid broken img icons
	const emailCss = extractEmailCss(html);
	const sanitized = sanitizeEmailHtml(html).replace(
		/src="cid:[^"]*"/gi,
		'src=""',
	);
	return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; script-src 'none';">
<base target="_blank" rel="noopener noreferrer">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    background: #ffffff;
    color: #1a1a1a;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: break-word;
  }
  img { max-width: 100%; height: auto; display: inline-block; }
  a { color: #1a73e8; }
  table { max-width: 100% !important; }
  pre { white-space: pre-wrap; font-family: inherit; }
</style>
<style>${emailCss}</style>
</head>
<body>${sanitized}</body>
</html>`;
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
