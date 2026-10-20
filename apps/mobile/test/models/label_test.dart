import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/models/label.dart';

void main() {
  test('label colours match the web hash (reference values from Node.js)', () {
    // Generated with the exact JS from packages/api/.../label-colors.ts.
    const expected = {
      'Newsletter': 9,
      'Receipts': 1,
      'Invoices': 0,
      'Promotions': 2,
      'Social': 3,
      'Work': 9,
      'Brand deals': 0,
      'Investor updates': 2,
      'Very Long Label Name With Many Characters 12345': 9,
      'naïve café': 0,
      '📧 Emoji': 6,
    };
    for (final entry in expected.entries) {
      expect(labelColorIndex(entry.key), entry.value, reason: entry.key);
    }
  });
}
