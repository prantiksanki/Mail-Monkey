import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/state_views.dart';
import 'mail_providers.dart';

/// Message actions shared by the inbox list and the message screen. Each
/// optimistically updates the list, calls the API, and rolls back on error.
enum MessageAction { archive, trash, delete, markRead, markUnread }

extension MessageActionLabels on MessageAction {
  String get doneLabel => switch (this) {
    MessageAction.archive => 'Archived',
    MessageAction.trash => 'Moved to Trash',
    MessageAction.delete => 'Deleted forever',
    MessageAction.markRead => 'Marked as read',
    MessageAction.markUnread => 'Marked as unread',
  };

  bool get removesFromList =>
      this == MessageAction.archive ||
      this == MessageAction.trash ||
      this == MessageAction.delete;
}

/// Runs [action] on [messageId]. [query] is the list it was shown in, so it
/// can be updated in place. Returns true on success.
Future<bool> runMessageAction(
  BuildContext context,
  WidgetRef ref, {
  required MessageAction action,
  required String mailboxId,
  required String messageId,
  InboxQuery? query,
}) async {
  if (action == MessageAction.delete) {
    final confirmed = await confirmAction(
      context,
      title: 'Delete forever?',
      message: 'This message will be permanently deleted. This can\'t be undone.',
      confirmLabel: 'Delete forever',
    );
    if (!confirmed) return false;
  }

  final mail = ref.read(mailServiceProvider);
  final list = query == null ? null : ref.read(inboxProvider(query).notifier);
  VoidCallback? rollback;
  if (list != null) {
    if (action.removesFromList) {
      rollback = list.removeLocally(messageId);
    } else {
      final unread = action == MessageAction.markUnread;
      list.setUnreadLocally(messageId, unread: unread);
      rollback = () => list.setUnreadLocally(messageId, unread: !unread);
    }
  }

  try {
    switch (action) {
      case MessageAction.archive:
        await mail.archive(mailboxId, messageId);
      case MessageAction.trash:
        await mail.trash(mailboxId, messageId);
      case MessageAction.delete:
        await mail.delete(mailboxId, messageId);
      case MessageAction.markRead:
        await mail.markRead(mailboxId, messageId);
      case MessageAction.markUnread:
        await mail.markUnread(mailboxId, messageId);
    }
    ref.invalidate(labelCountsProvider(mailboxId));
    if (context.mounted) showMessage(context, action.doneLabel);
    return true;
  } catch (e) {
    rollback?.call();
    if (context.mounted) showMessage(context, errorMessage(e), error: true);
    return false;
  }
}

/// Snooze presets matching the web snooze menu.
Future<DateTime?> pickSnoozeTime(BuildContext context) async {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final options = <String, DateTime>{
    'Later today (in 3 hours)': now.add(const Duration(hours: 3)),
    'Tomorrow, 9:00': today.add(const Duration(days: 1, hours: 9)),
    'This weekend (Sat 9:00)': today.add(
      Duration(days: (DateTime.saturday - now.weekday + 7) % 7 == 0 ? 7 : (DateTime.saturday - now.weekday + 7) % 7, hours: 9),
    ),
    'Next week (Mon 9:00)': today.add(
      Duration(days: (DateTime.monday - now.weekday + 7) % 7 == 0 ? 7 : (DateTime.monday - now.weekday + 7) % 7, hours: 9),
    ),
  };
  return showModalBottomSheet<DateTime>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const ListTile(title: Text('Snooze until…')),
          for (final entry in options.entries)
            ListTile(
              leading: const Icon(Icons.snooze_outlined),
              title: Text(entry.key),
              onTap: () => Navigator.of(context).pop(entry.value),
            ),
          ListTile(
            leading: const Icon(Icons.event_outlined),
            title: const Text('Pick date & time'),
            onTap: () async {
              final picked = await pickDateTime(context, initial: now.add(const Duration(days: 1)));
              if (context.mounted) Navigator.of(context).pop(picked);
            },
          ),
        ],
      ),
    ),
  );
}

/// Date then time picker; returns null if either is cancelled or the result
/// is in the past.
Future<DateTime?> pickDateTime(BuildContext context, {required DateTime initial}) async {
  final now = DateTime.now();
  final date = await showDatePicker(
    context: context,
    initialDate: initial,
    firstDate: DateTime(now.year, now.month, now.day),
    lastDate: now.add(const Duration(days: 365)),
  );
  if (date == null || !context.mounted) return null;
  final time = await showTimePicker(
    context: context,
    initialTime: TimeOfDay.fromDateTime(initial),
  );
  if (time == null) return null;
  final result = DateTime(date.year, date.month, date.day, time.hour, time.minute);
  if (result.isBefore(now)) {
    if (context.mounted) showMessage(context, 'Pick a time in the future.', error: true);
    return null;
  }
  return result;
}
