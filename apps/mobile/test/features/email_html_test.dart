import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/features/mail/message/email_html.dart';

void main() {
  group('sanitizeEmailHtml', () {
    test('removes scripts, frames, forms and event handlers', () {
      const dirty =
          '<p onclick="steal()">Hi</p><script>alert(1)</script>'
          '<iframe src="https://evil"></iframe><form action="x"><input></form>'
          '<img src="https://a/b.png" onerror="x()">';
      final clean = sanitizeEmailHtml(dirty);
      expect(clean, isNot(contains('script')));
      expect(clean, isNot(contains('iframe')));
      expect(clean, isNot(contains('<form')));
      expect(clean, isNot(contains('onclick')));
      expect(clean, isNot(contains('onerror')));
      expect(clean, contains('<p>Hi</p>'));
      expect(clean, contains('src="https://a/b.png"'));
    });

    test('strips javascript: and vbscript: URLs but keeps normal links', () {
      final clean = sanitizeEmailHtml(
        '<a href="javascript:evil()">x</a><a href=\'vbscript:y\'>y</a>'
        '<a href="https://ok.example">ok</a>',
      );
      expect(clean, isNot(contains('javascript:')));
      expect(clean, isNot(contains('vbscript:')));
      expect(clean, contains('href="https://ok.example"'));
    });

    test('blanks cid: images', () {
      expect(sanitizeEmailHtml('<img src="cid:logo@x">'), '<img src="">');
    });
  });

  group('extractEmailCss', () {
    test('keeps email CSS but drops @import and script-in-CSS', () {
      final css = extractEmailCss(
        '<style>.wrapper{color:red}@import url(https://x/y.css);'
        '.a{width:expression(alert(1))}</style>',
      );
      expect(css, contains('.wrapper{color:red}'));
      expect(css, isNot(contains('@import')));
      expect(css, isNot(contains('expression(')));
    });
  });

  group('buildEmailDocument', () {
    test('wraps HTML with a no-script CSP and the email CSS', () {
      final doc = buildEmailDocument(
        bodyHtml: '<style>.x{a:b}</style><p class="x">Hello</p>',
        bodyText: '',
      );
      expect(doc, contains("script-src 'none'"));
      expect(doc, contains('.x{a:b}'));
      expect(doc, contains('<p class="x">Hello</p>'));
    });

    test('falls back to escaped plain text when there is no HTML', () {
      final doc = buildEmailDocument(bodyHtml: '', bodyText: 'a < b & c');
      expect(doc, contains('<pre>a &lt; b &amp; c</pre>'));
    });
  });
}
