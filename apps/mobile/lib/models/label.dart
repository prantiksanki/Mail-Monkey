import 'package:flutter/material.dart';

/// A label shown in the mailbox navigation. On the web these come from rules
/// with a LABEL action plus an IMAP account's own folders
/// (apps/web/modules/saas/shared/components/NavBar.tsx).
class MailLabel {
  const MailLabel({required this.id, required this.name});

  final String id;
  final String name;

  LabelColor get color => labelColorForName(name);
}

class LabelColor {
  const LabelColor(this.background, this.foreground);

  final Color background;
  final Color foreground;
}

const _labelColors = [
  LabelColor(Color(0xFFFB4C2F), Colors.white), // red
  LabelColor(Color(0xFFFFAD47), Colors.white), // orange
  LabelColor(Color(0xFFFAD165), Colors.black), // yellow
  LabelColor(Color(0xFF16A766), Colors.white), // green
  LabelColor(Color(0xFF4A86E8), Colors.white), // blue
  LabelColor(Color(0xFFA479E2), Colors.white), // purple
  LabelColor(Color(0xFFF691B3), Colors.black), // pink
  LabelColor(Color(0xFF2DA2BB), Colors.white), // teal
  LabelColor(Color(0xFFB99AFF), Colors.black), // lavender
  LabelColor(Color(0xFF8A63D2), Colors.white), // deep purple
];

/// Same hash as `labelColorForName` in packages/api/.../label-colors.ts, so a
/// label has the same colour on web and mobile. In JavaScript only `<<`
/// works on 32-bit integers (its operand is converted with ToInt32 and the
/// result wraps); the `+`/`-` around it are plain number arithmetic.
LabelColor labelColorForName(String name) =>
    _labelColors[labelColorIndex(name)];

@visibleForTesting
int labelColorIndex(String name) {
  var hash = 0;
  for (final unit in name.codeUnits) {
    final shifted = (hash.toSigned(32) << 5).toSigned(32);
    hash = unit + (shifted - hash);
  }
  return hash.abs() % _labelColors.length;
}
