import 'package:intl/intl.dart';

/// Inbox-style date: time today, weekday this week, "12 Oct" this year,
/// otherwise "12 Oct 2025".
String formatListDate(DateTime? date, {DateTime? now}) {
  if (date == null) return '';
  final reference = now ?? DateTime.now();
  final today = DateTime(reference.year, reference.month, reference.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return DateFormat.jm().format(date);
  if (diff > 0 && diff < 7) return DateFormat.E().format(date);
  if (date.year == reference.year) return DateFormat.MMMd().format(date);
  return DateFormat.yMMMd().format(date);
}

/// Full timestamp for message headers, e.g. "Tue, 13 Oct 2026, 09:39".
String formatFullDate(DateTime? date) {
  if (date == null) return '';
  return DateFormat('EEE, d MMM y, HH:mm').format(date);
}

/// "in 2 h", "tomorrow 09:00"-style label for scheduled/snoozed times.
String formatUpcoming(DateTime? date, {DateTime? now}) {
  if (date == null) return '';
  final reference = now ?? DateTime.now();
  final today = DateTime(reference.year, reference.month, reference.day);
  final day = DateTime(date.year, date.month, date.day);
  final diff = day.difference(today).inDays;
  final time = DateFormat.jm().format(date);
  if (diff == 0) return 'Today $time';
  if (diff == 1) return 'Tomorrow $time';
  if (diff > 1 && diff < 7) return '${DateFormat.EEEE().format(date)} $time';
  return '${DateFormat.MMMd().format(date)} $time';
}

String formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(0)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}

/// `"Jia from Unstop <noreply@…>"` → `"Jia from Unstop"`.
String displayNameFromAddress(String value) {
  final match = RegExp(r'^\s*"?([^"<]*?)"?\s*<[^>]+>\s*$').firstMatch(value);
  final name = match?.group(1)?.trim();
  return (name != null && name.isNotEmpty) ? name : value.trim();
}

/// First address in a header value: `"A <a@x.com>, b@y.com"` → `"a@x.com"`.
String firstEmailAddress(String value) {
  final angle = RegExp(r'<([^>]+)>').firstMatch(value);
  if (angle != null) return angle.group(1)!.trim();
  return value.split(',').first.trim();
}
