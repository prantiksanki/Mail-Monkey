import 'dart:convert';

/// Builds the self-contained HTML document for an email body — a port of
/// `buildEmailSrcDoc` in apps/web/modules/saas/mailboxes/lib/email-html.ts.
///
/// Defense in depth, as on the web: dangerous markup is stripped here, the
/// document carries a CSP with `script-src 'none'`, and the WebView that
/// renders it has JavaScript disabled.
String buildEmailDocument({required String bodyHtml, required String bodyText, bool dark = false}) {
  final content = bodyHtml.trim().isNotEmpty
      ? sanitizeEmailHtml(bodyHtml)
      : '<pre>${htmlEscape.convert(bodyText)}</pre>';
  final css = extractEmailCss(bodyHtml);
  final background = dark ? '#0f1115' : '#ffffff';
  final color = dark ? '#e5e7eb' : '#1a1a1a';
  return '''<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data:; script-src 'none';">
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 12px 16px;
    background: $background;
    color: $color;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.55;
    overflow-wrap: break-word;
  }
  img { max-width: 100%; height: auto; display: inline-block; }
  a { color: #1a73e8; }
  table { max-width: 100% !important; }
  pre { white-space: pre-wrap; font-family: inherit; }
</style>
<style>$css</style>
</head>
<body>$content</body>
</html>''';
}

/// Escapes plain text into HTML, preserving line breaks (web `plainTextToHtml`).
String plainTextToHtml(String text) =>
    htmlEscape.convert(text).replaceAll(RegExp(r'\r?\n'), '<br>');

/// Gmail-style forwarded block — port of the web's `buildForwardHtml`, so a
/// forward from the app looks the same as one from the web. Prefers the
/// original HTML body, falling back to escaped plain text.
String buildForwardHtml({
  required String from,
  required String to,
  required String subject,
  required String date,
  required String bodyHtml,
  required String bodyText,
}) {
  final body = bodyHtml.trim().isNotEmpty
      ? sanitizeEmailHtml(bodyHtml)
      : bodyText.trim().isNotEmpty
      ? plainTextToHtml(bodyText)
      : '<p>(No content)</p>';
  final headerLines = [
    '<b>From:</b> ${plainTextToHtml(from)}',
    '<b>Date:</b> ${plainTextToHtml(date)}',
    '<b>Subject:</b> ${plainTextToHtml(subject)}',
    '<b>To:</b> ${plainTextToHtml(to)}',
  ].join('<br>');
  return [
    '<div class="gmail_quote">',
    '<div dir="ltr" class="gmail_attr">---------- Forwarded message ----------<br>',
    headerLines,
    '</div>',
    '<br>',
    '<div class="forwarded-body">$body</div>',
    '</div>',
  ].join();
}

final _blockTags = RegExp(
  r'<(script|style|iframe|object|embed|noscript|template|title|head)\b[^>]*>[\s\S]*?</\1\s*>',
  caseSensitive: false,
);
final _singleTags = RegExp(
  r'</?(script|iframe|object|embed|form|link|meta|base|html|body)\b[^>]*>',
  caseSensitive: false,
);
final _handlers = RegExp(
  r'''\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)''',
  caseSensitive: false,
);
final _scriptUrls = RegExp(
  r'''\s+(href|src|action|formaction|xlink:href)\s*=\s*("\s*(?:javascript|vbscript|data:text/html)[^"]*"|'\s*(?:javascript|vbscript|data:text/html)[^']*'|\s*(?:javascript|vbscript)[^\s>]*)''',
  caseSensitive: false,
);
final _cidImages = RegExp(r'''src\s*=\s*("cid:[^"]*"|'cid:[^']*')''', caseSensitive: false);

/// Removes scripts, frames, forms, event handlers and script URLs while
/// keeping formatting, tables, images and links.
String sanitizeEmailHtml(String html) => html
    .replaceAll(_blockTags, '')
    .replaceAll(_singleTags, '')
    .replaceAll(_handlers, '')
    .replaceAll(_scriptUrls, '')
    // Inline (cid:) attachments aren't fetched — avoid broken-image icons.
    .replaceAll(_cidImages, 'src=""');

/// The email's own `<style>` CSS (layouts like GitHub notifications depend
/// on it), with markup, `@import` and legacy script-in-CSS removed —
/// same rules as the web's `extractEmailCss`.
String extractEmailCss(String html) {
  final blocks = RegExp(r'<style\b[^>]*>([\s\S]*?)</style>', caseSensitive: false)
      .allMatches(html)
      .map((m) => m.group(1) ?? '');
  return blocks
      .map(
        (css) => css
            .replaceAll(RegExp(r'</?[a-z][^>]*>', caseSensitive: false), '')
            .replaceAll(RegExp(r'@import[^;]*;?', caseSensitive: false), '')
            .replaceAll(RegExp(r'expression\s*\(', caseSensitive: false), '')
            .replaceAll(RegExp(r'(java|vb)script:', caseSensitive: false), ''),
      )
      .join('\n');
}

/// Best-effort HTML → plain text for feeding the model a clean body (web
/// AiDraftPanel `htmlToText`).
String htmlToText(String html) => html
    .replaceAll(RegExp(r'<style[\s\S]*?</style>', caseSensitive: false), ' ')
    .replaceAll(RegExp(r'<script[\s\S]*?</script>', caseSensitive: false), ' ')
    .replaceAll(RegExp(r'</(p|div|br|li|tr|h[1-6])>', caseSensitive: false), '\n')
    .replaceAll(RegExp('<[^>]+>'), ' ')
    .replaceAll(RegExp('&nbsp;', caseSensitive: false), ' ')
    .replaceAll(RegExp('&amp;', caseSensitive: false), '&')
    .replaceAll(RegExp('&lt;', caseSensitive: false), '<')
    .replaceAll(RegExp('&gt;', caseSensitive: false), '>')
    .replaceAll(RegExp(r'[ \t]+'), ' ')
    .replaceAll(RegExp(r'\n{3,}'), '\n\n')
    .trim();

final _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');

/// First candidate that is (or contains, as `Name <a@b.com>`) a valid email,
/// or '' — never a display name, which Gmail rejects in the To header.
String pickEmail(List<String?> candidates) {
  for (final raw in candidates) {
    final value = raw?.trim() ?? '';
    if (value.isEmpty) continue;
    final angle = RegExp('<([^>]+)>').firstMatch(value)?.group(1)?.trim();
    if (angle != null && _emailPattern.hasMatch(angle)) return angle;
    if (_emailPattern.hasMatch(value)) return value;
  }
  return '';
}
