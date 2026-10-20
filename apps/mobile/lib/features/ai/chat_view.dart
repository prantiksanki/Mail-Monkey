import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/routing/routes.dart';
import '../../models/ai_chat.dart';
import '../../models/json.dart';
import 'chat_controller.dart';

/// Builds an extra widget for a tool part (e.g. the rule proposal card).
typedef ToolPartBuilder = Widget? Function(BuildContext context, ToolPart tool);

/// Human-readable labels for the inbox assistant's tools.
const _toolLabels = {
  'searchEmails': 'Searching your email',
  'findUnansweredThreads': 'Finding unanswered threads',
  'readEmail': 'Reading an email',
  'listActiveRules': 'Checking your rules',
  'getDashboardSummary': 'Checking your dashboard',
  'listLabels': 'Listing labels',
  'listScheduledEmails': 'Checking scheduled emails',
  'listSnoozedEmails': 'Checking snoozed emails',
  'getCalendar': 'Checking your calendar',
  'archiveEmail': 'Archive email',
  'snoozeEmail': 'Snooze email',
  'markEmailRead': 'Mark as read',
  'markEmailUnread': 'Mark as unread',
  'applyLabelToEmail': 'Apply label',
  'saveDraft': 'Save draft',
  'cancelScheduledEmail': 'Cancel scheduled email',
  'cancelSnooze': 'Cancel snooze',
  'createReminder': 'Create reminder',
  'listReminders': 'Checking reminders',
  'cancelReminder': 'Cancel reminder',
  'sendEmail': 'Send email',
  'sendSavedDraft': 'Send draft',
  'scheduleEmail': 'Schedule email',
  'deleteEmail': 'Delete email permanently',
  'trashEmail': 'Move email to Trash',
  'createMeeting': 'Create meeting',
  'createCalendarEvent': 'Create calendar event',
  'citeEmails': 'Sources',
  'proposeRule': 'Proposed rule',
};

/// Message list + input bar for a [ChatController].
class ChatView extends StatefulWidget {
  const ChatView({
    super.key,
    required this.controller,
    this.emptyTitle = 'Ask Mail Monkey anything',
    this.emptyHint,
    this.suggestions = const [],
    this.toolBuilder,
  });

  final ChatController controller;
  final String emptyTitle;
  final String? emptyHint;
  final List<String> suggestions;
  final ToolPartBuilder? toolBuilder;

  @override
  State<ChatView> createState() => _ChatViewState();
}

class _ChatViewState extends State<ChatView> {
  final _input = TextEditingController();
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onChange);
  }

  @override
  void didUpdateWidget(covariant ChatView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller.removeListener(_onChange);
      widget.controller.addListener(_onChange);
    }
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onChange);
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _onChange() {
    setState(() {});
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) {
        _scroll.animateTo(
          _scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _submit([String? text]) {
    final value = text ?? _input.text;
    if (value.trim().isEmpty) return;
    _input.clear();
    widget.controller.sendText(value);
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final theme = Theme.of(context);
    return Column(
      children: [
        Expanded(
          child: c.messages.isEmpty
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    const SizedBox(height: 48),
                    Icon(Icons.auto_awesome, size: 48, color: theme.colorScheme.primary),
                    const SizedBox(height: 16),
                    Text(widget.emptyTitle, textAlign: TextAlign.center, style: theme.textTheme.titleLarge),
                    if (widget.emptyHint != null) ...[
                      const SizedBox(height: 8),
                      Text(widget.emptyHint!, textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
                    ],
                    const SizedBox(height: 24),
                    Wrap(
                      alignment: WrapAlignment.center,
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final s in widget.suggestions) ActionChip(label: Text(s), onPressed: () => _submit(s)),
                      ],
                    ),
                  ],
                )
              : ListView.builder(
                  controller: _scroll,
                  padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
                  itemCount: c.messages.length + (c.streaming || c.error != null ? 1 : 0),
                  itemBuilder: (context, i) {
                    if (i == c.messages.length) {
                      return c.error != null
                          ? Padding(
                              padding: const EdgeInsets.all(8),
                              child: Text(c.error!, style: TextStyle(color: theme.colorScheme.error)),
                            )
                          : const Padding(
                              padding: EdgeInsets.all(12),
                              child: Align(alignment: Alignment.centerLeft, child: _TypingDots()),
                            );
                    }
                    return _MessageBubble(
                      message: c.messages[i],
                      controller: c,
                      isLast: i == c.messages.length - 1,
                      toolBuilder: widget.toolBuilder,
                    );
                  },
                ),
        ),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 4, 12, 8),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _input,
                    minLines: 1,
                    maxLines: 5,
                    textInputAction: TextInputAction.send,
                    textCapitalization: TextCapitalization.sentences,
                    onSubmitted: (_) => _submit(),
                    decoration: const InputDecoration(hintText: 'Message'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  tooltip: c.streaming ? 'Stop' : 'Send',
                  onPressed: c.streaming ? c.stop : _submit,
                  icon: Icon(c.streaming ? Icons.stop : Icons.arrow_upward),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _MessageBubble extends StatelessWidget {
  const _MessageBubble({required this.message, required this.controller, required this.isLast, this.toolBuilder});

  final ChatMessage message;
  final ChatController controller;
  final bool isLast;
  final ToolPartBuilder? toolBuilder;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final user = message.isUser;
    final children = <Widget>[];
    for (final part in message.parts) {
      final type = part['type']?.toString() ?? '';
      if (type == 'text' && (part['text']?.toString().isNotEmpty ?? false)) {
        final text = part['text'].toString();
        // Assistant replies are Markdown (GFM), like the web's Markdown view.
        children.add(user ? SelectableText(text) : _Markdown(text: text));
      } else if (type.startsWith('tool-')) {
        final tool = ToolPart(part);
        final custom = toolBuilder?.call(context, tool);
        children.add(custom ?? _ToolCard(tool: tool, controller: controller, canAct: isLast && !controller.streaming));
      }
    }
    if (children.isEmpty) return const SizedBox.shrink();
    return Align(
      alignment: user ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.85),
        decoration: BoxDecoration(
          color: user ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: DefaultTextStyle.merge(
          style: TextStyle(color: user ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, spacing: 8, children: children),
        ),
      ),
    );
  }
}

class _Markdown extends StatelessWidget {
  const _Markdown({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.textTheme.bodyMedium?.copyWith(color: theme.colorScheme.onSurface);
    return MarkdownBody(
      data: text,
      selectable: true,
      styleSheet: MarkdownStyleSheet.fromTheme(theme).copyWith(
        p: base,
        listBullet: base,
        code: theme.textTheme.bodySmall?.copyWith(
          fontFamily: 'monospace',
          backgroundColor: theme.colorScheme.surfaceContainerLow,
        ),
      ),
      onTapLink: (_, href, _) {
        final uri = href == null ? null : Uri.tryParse(href);
        if (uri != null && const {'http', 'https', 'mailto'}.contains(uri.scheme)) {
          launchUrl(uri, mode: LaunchMode.externalApplication);
        }
      },
    );
  }
}

/// Tool activity: a status line, cited emails, or an approval card for
/// actions the assistant must confirm (send, schedule, delete, trash,
/// meetings/events).
class _ToolCard extends StatelessWidget {
  const _ToolCard({required this.tool, required this.controller, required this.canAct});

  final ToolPart tool;
  final ChatController controller;
  final bool canAct;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final label = _toolLabels[tool.name] ?? tool.name;

    if (tool.name == 'citeEmails' && tool.isDone) {
      final ids = _citedIds(tool);
      if (ids.isEmpty) return const SizedBox.shrink();
      return Wrap(
        spacing: 6,
        runSpacing: 6,
        children: [
          for (var i = 0; i < ids.length; i++)
            ActionChip(
              avatar: const Icon(Icons.mail_outline, size: 16),
              label: Text('Email ${i + 1}'),
              onPressed: () => context.push(Routes.messagePath(ids[i])),
            ),
        ],
      );
    }

    if (tool.awaitingApproval || tool.state == 'approval-responded') {
      final approved = asMap(tool.raw['approval'])['approved'];
      return Card(
        margin: EdgeInsets.zero,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: theme.textTheme.titleSmall),
              const SizedBox(height: 6),
              for (final entry in tool.input.entries)
                if (entry.value != null && entry.value.toString().isNotEmpty)
                  Text('${_title(entry.key)}: ${_preview(entry.value)}', style: theme.textTheme.bodySmall),
              const SizedBox(height: 8),
              if (tool.awaitingApproval && canAct && tool.approvalId != null)
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => controller.answerApproval(tool.approvalId!, approved: false),
                        child: const Text('Cancel'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: FilledButton(
                        onPressed: () => controller.answerApproval(tool.approvalId!, approved: true),
                        child: const Text('Approve'),
                      ),
                    ),
                  ],
                )
              else
                Text(approved == true ? 'Approved' : approved == false ? 'Cancelled' : 'Waiting for approval',
                    style: theme.textTheme.labelMedium),
            ],
          ),
        ),
      );
    }

    final icon = switch (tool.state) {
      'output-available' => Icons.check_circle_outline,
      'output-error' => Icons.error_outline,
      'output-denied' => Icons.block,
      _ => Icons.hourglass_empty,
    };
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: theme.colorScheme.onSurfaceVariant),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            tool.state == 'output-error' ? '$label failed: ${tool.errorText ?? ''}' : label,
            style: theme.textTheme.labelMedium?.copyWith(color: theme.colorScheme.onSurfaceVariant),
          ),
        ),
      ],
    );
  }

  static List<String> _citedIds(ToolPart tool) {
    final input = tool.input;
    final raw = input['emailIds'] ?? input['ids'] ?? input['messageIds'];
    if (raw is List) {
      return [
        for (final e in raw)
          if (e is String) e else if (asMap(e).isNotEmpty) (asMap(e)['id'] ?? asMap(e)['messageId']).toString(),
      ];
    }
    return [for (final e in asMapList(input['emails'])) (e['id'] ?? e['messageId']).toString()];
  }

  static String _title(String key) => key.isEmpty ? key : key[0].toUpperCase() + key.substring(1);

  static String _preview(Object? value) {
    final text = value is String ? value : jsonEncode(value);
    return text.length > 160 ? '${text.substring(0, 160)}…' : text;
  }
}

class _TypingDots extends StatefulWidget {
  const _TypingDots();

  @override
  State<_TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<_TypingDots> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 900))
    ..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _c,
    builder: (context, _) => Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 3; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Opacity(
              opacity: ((_c.value * 3 - i) % 3) < 1 ? 1 : 0.3,
              child: const CircleAvatar(radius: 4),
            ),
          ),
      ],
    ),
  );
}
