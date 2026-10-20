import 'package:flutter/material.dart';

import '../../../models/message.dart';
import '../../../shared/utils/format.dart';

/// One row in a message list: avatar, sender, date, subject and snippet.
/// Unread messages are bold, like the web inbox.
class MessageTile extends StatelessWidget {
  const MessageTile({super.key, required this.message, required this.onTap});

  final MessageSummary message;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final unread = message.isUnread;
    final weight = unread ? FontWeight.w700 : FontWeight.w400;
    final sender = message.senderName;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: theme.colorScheme.primaryContainer,
              child: Text(
                sender.isNotEmpty ? sender.characters.first.toUpperCase() : '?',
                style: TextStyle(color: theme.colorScheme.onPrimaryContainer),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          sender,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: weight),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        formatListDate(message.date),
                        style: theme.textTheme.labelSmall?.copyWith(
                          fontWeight: weight,
                          color: unread ? theme.colorScheme.primary : theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message.subject.isNotEmpty ? message.subject : '(no subject)',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodyMedium?.copyWith(fontWeight: weight),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    message.snippet,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: theme.colorScheme.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
            ),
            if (unread)
              Padding(
                padding: const EdgeInsets.only(left: 8, top: 6),
                child: Icon(Icons.circle, size: 10, color: theme.colorScheme.primary),
              ),
          ],
        ),
      ),
    );
  }
}
