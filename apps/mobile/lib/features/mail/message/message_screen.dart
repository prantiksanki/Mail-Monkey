import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/routes.dart';
import '../../../models/message.dart';
import '../../../shared/utils/format.dart';
import '../../../shared/widgets/state_views.dart';
import '../../ai/ai_draft_sheet.dart';
import '../compose/compose_screen.dart';
import '../mail_providers.dart';
import '../message_actions.dart';
import 'email_body_view.dart';
import 'headers_sheet.dart';

final messageDetailProvider =
    FutureProvider.family<MessageDetail, ({String mailboxId, String messageId})>(
      (ref, key) => ref.watch(mailServiceProvider).getMessage(key.mailboxId, key.messageId),
    );

class MessageScreen extends ConsumerStatefulWidget {
  const MessageScreen({super.key, required this.messageId, this.query});

  final String messageId;

  /// The list this message was opened from, kept in sync with actions.
  final InboxQuery? query;

  @override
  ConsumerState<MessageScreen> createState() => _MessageScreenState();
}

class _MessageScreenState extends ConsumerState<MessageScreen> {
  bool _markedRead = false;

  String? get _mailboxId => widget.query?.mailboxId ?? ref.read(selectedMailboxProvider)?.id;

  Future<void> _act(MessageAction action) async {
    final mailboxId = _mailboxId;
    if (mailboxId == null) return;
    final ok = await runMessageAction(
      context,
      ref,
      action: action,
      mailboxId: mailboxId,
      messageId: widget.messageId,
      query: widget.query,
    );
    if (ok && action.removesFromList && mounted) context.pop();
  }

  void _markReadOnOpen(MessageDetail message) {
    if (_markedRead || !message.isUnread) return;
    _markedRead = true;
    // Called from build(): providers can't be modified until the frame ends.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final mailboxId = _mailboxId;
      if (!mounted || mailboxId == null) return;
      if (widget.query != null) {
        ref.read(inboxProvider(widget.query!).notifier).setUnreadLocally(message.id, unread: false);
      }
      unawaited(
        ref
            .read(mailServiceProvider)
            .markRead(mailboxId, message.id)
            .then((_) => ref.invalidate(labelCountsProvider(mailboxId)))
            .catchError((Object _) {}),
      );
    });
  }

  Future<void> _snooze() async {
    final mailboxId = _mailboxId;
    final until = await pickSnoozeTime(context);
    if (until == null || mailboxId == null || !mounted) return;
    try {
      await ref.read(mailServiceProvider).snooze(mailboxId, widget.messageId, until);
      if (widget.query != null) {
        ref.read(inboxProvider(widget.query!).notifier).removeLocally(widget.messageId);
      }
      ref.invalidate(labelCountsProvider(mailboxId));
      if (!mounted) return;
      showMessage(context, 'Snoozed until ${formatUpcoming(until)}');
      context.pop();
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _applyLabel() async {
    final mailboxId = _mailboxId;
    if (mailboxId == null) return;
    final labels = ref.read(labelsProvider(mailboxId));
    final controller = TextEditingController();
    final name = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const ListTile(title: Text('Apply label')),
              for (final label in labels)
                ListTile(
                  leading: Icon(Icons.label, color: label.color.background),
                  title: Text(label.name),
                  onTap: () => Navigator.of(context).pop(label.name),
                ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
                child: TextField(
                  controller: controller,
                  decoration: InputDecoration(
                    labelText: 'New label',
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.check),
                      onPressed: () => Navigator.of(context).pop(controller.text.trim()),
                    ),
                  ),
                  onSubmitted: (v) => Navigator.of(context).pop(v.trim()),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    controller.dispose();
    if (name == null || name.isEmpty || !mounted) return;
    try {
      await ref.read(mailServiceProvider).applyLabel(mailboxId, widget.messageId, name);
      ref.invalidate(labelCountsProvider(mailboxId));
      if (mounted) showMessage(context, 'Label "$name" applied');
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _remind(MessageDetail message) async {
    final mailboxId = _mailboxId;
    if (mailboxId == null) return;
    final at = await pickDateTime(context, initial: DateTime.now().add(const Duration(days: 1)));
    if (at == null || !mounted) return;
    try {
      await ref.read(mailServiceProvider).createReminder(
        mailboxId,
        'Follow up: ${message.subject.isNotEmpty ? message.subject : 'email from ${message.senderName}'}',
        at,
      );
      if (mounted) showMessage(context, 'Reminder set for ${formatUpcoming(at)}');
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mailboxId = widget.query?.mailboxId ?? ref.watch(selectedMailboxProvider)?.id;
    if (mailboxId == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator()));
    }
    final key = (mailboxId: mailboxId, messageId: widget.messageId);
    final detail = ref.watch(messageDetailProvider(key));
    final inTrash = widget.query?.folder == 'trash';

    return Scaffold(
      appBar: AppBar(
        actions: [
          if (!inTrash)
            IconButton(
              tooltip: 'Archive',
              icon: const Icon(Icons.archive_outlined),
              onPressed: () => _act(MessageAction.archive),
            ),
          IconButton(
            tooltip: inTrash ? 'Delete forever' : 'Move to Trash',
            icon: Icon(inTrash ? Icons.delete_forever_outlined : Icons.delete_outline),
            onPressed: () => _act(inTrash ? MessageAction.delete : MessageAction.trash),
          ),
          IconButton(
            tooltip: 'Mark as unread',
            icon: const Icon(Icons.mark_email_unread_outlined),
            onPressed: () async {
              await _act(MessageAction.markUnread);
              if (context.mounted) context.pop();
            },
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              final message = detail.value;
              switch (value) {
                case 'snooze':
                  unawaited(_snooze());
                case 'label':
                  unawaited(_applyLabel());
                case 'remind':
                  if (message != null) unawaited(_remind(message));
                case 'headers':
                  showHeadersSheet(context, mailboxId: mailboxId, messageId: widget.messageId);
                case 'delete':
                  unawaited(_act(MessageAction.delete));
              }
            },
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'snooze', child: Text('Snooze')),
              const PopupMenuItem(value: 'label', child: Text('Apply label')),
              const PopupMenuItem(value: 'remind', child: Text('Remind me')),
              const PopupMenuItem(value: 'headers', child: Text('Show original headers')),
              if (!inTrash) const PopupMenuItem(value: 'delete', child: Text('Delete forever')),
            ],
          ),
        ],
      ),
      body: detail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(messageDetailProvider(key))),
        data: (message) {
          _markReadOnOpen(message);
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _MessageHeader(message: message),
              const Divider(height: 1),
              Expanded(
                child: EmailBodyView(bodyHtml: message.bodyHtml, bodyText: message.bodyText),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: detail.hasValue
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push(
                          Routes.compose,
                          extra: ComposeArgs.reply(detail.value!),
                        ),
                        icon: const Icon(Icons.reply),
                        label: const Text('Reply'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.push(
                          Routes.compose,
                          extra: ComposeArgs.forward(detail.value!),
                        ),
                        icon: const Icon(Icons.forward),
                        label: const Text('Forward'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    IconButton.filledTonal(
                      tooltip: 'AI draft',
                      onPressed: () => showAiDraftSheet(context, mailboxId: mailboxId, message: detail.value!),
                      icon: const Icon(Icons.auto_awesome),
                    ),
                  ],
                ),
              ),
            )
          : null,
    );
  }
}

class _MessageHeader extends StatelessWidget {
  const _MessageHeader({required this.message});

  final MessageDetail message;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final cc = message.header('cc');
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SelectableText(
            message.subject.isNotEmpty ? message.subject : '(no subject)',
            style: theme.textTheme.titleLarge,
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                child: Text(message.senderName.characters.first.toUpperCase()),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(message.senderName, style: theme.textTheme.titleSmall),
                    Text(
                      message.fromEmail,
                      style: theme.textTheme.bodySmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'To: ${message.to}${cc != null && cc.isNotEmpty ? '\nCc: $cc' : ''}',
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                ),
              ),
              Text(formatFullDate(message.date), style: theme.textTheme.labelSmall),
            ],
          ),
          if (message.attachments.isNotEmpty) ...[
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final a in message.attachments)
                  Chip(
                    avatar: const Icon(Icons.attach_file, size: 18),
                    label: Text('${a.filename} · ${formatBytes(a.size)}'),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              'Attachments can be opened in your mail provider.',
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ],
        ],
      ),
    );
  }
}

/// Email body in a JavaScript-disabled WebView; links open in the browser.
