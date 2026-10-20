import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/ai_chat.dart';
import '../../models/rule.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'ai_providers.dart';
import 'chat_controller.dart';
import 'chat_view.dart';

/// Conversational rule builder (web RuleAssistantChat): the assistant asks
/// questions, then proposes a rule the user accepts (creating it) or rejects.
class RulesAssistantScreen extends ConsumerWidget {
  const RulesAssistantScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Rules assistant')),
      body: mailbox == null
          ? const EmptyView(icon: Icons.rule, title: 'Connect a mailbox to create rules')
          : _RulesChat(key: ValueKey(mailbox.id), mailboxId: mailbox.id),
    );
  }
}

class _RulesChat extends ConsumerStatefulWidget {
  const _RulesChat({super.key, required this.mailboxId});

  final String mailboxId;

  @override
  ConsumerState<_RulesChat> createState() => _RulesChatState();
}

class _RulesChatState extends ConsumerState<_RulesChat> {
  late final ChatController _chat;
  final Set<String> _creating = {};

  @override
  void initState() {
    super.initState();
    final ai = ref.read(aiServiceProvider);
    _chat = ChatController(
      send: (messages, cancel) =>
          ai.rulesAssistant(mailboxId: widget.mailboxId, messages: messages, cancelToken: cancel),
    );
  }

  @override
  void dispose() {
    _chat
      ..stop()
      ..dispose();
    super.dispose();
  }

  Future<void> _accept(ToolPart tool) async {
    final draft = RuleDraft.fromProposal(tool.input);
    setState(() => _creating.add(tool.toolCallId));
    try {
      await ref.read(rulesServiceProvider).create(widget.mailboxId, draft);
      ref.invalidate(rulesProvider(widget.mailboxId));
      if (mounted) showMessage(context, 'Rule "${draft.name}" created');
      await _chat.provideToolOutput(tool.toolCallId, {'action': 'accepted'});
    } on Exception {
      if (mounted) showMessage(context, 'Failed to create rule', error: true);
    } finally {
      if (mounted) setState(() => _creating.remove(tool.toolCallId));
    }
  }

  Widget? _buildTool(BuildContext context, ToolPart tool) {
    if (tool.name != 'proposeRule') return null;
    return _ProposalCard(
      tool: tool,
      busy: _creating.contains(tool.toolCallId),
      canAct: !_chat.streaming && tool.state == 'input-available',
      onAccept: () => _accept(tool),
      onReject: () => _chat.provideToolOutput(tool.toolCallId, {'action': 'rejected'}),
    );
  }

  @override
  Widget build(BuildContext context) => ChatView(
    controller: _chat,
    emptyTitle: 'Describe a rule',
    emptyHint: "Tell me what you'd like to happen to certain emails and I'll set up the rule.",
    suggestions: const [
      'Archive newsletters and label them',
      'Label receipts from Stripe as Finance',
      'Forward invoices to my accountant',
    ],
    toolBuilder: _buildTool,
  );
}

class _ProposalCard extends StatelessWidget {
  const _ProposalCard({
    required this.tool,
    required this.busy,
    required this.canAct,
    required this.onAccept,
    required this.onReject,
  });

  final ToolPart tool;
  final bool busy;
  final bool canAct;
  final VoidCallback onAccept;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (tool.state == 'input-streaming') {
      return const Card(
        margin: EdgeInsets.zero,
        child: Padding(padding: EdgeInsets.all(16), child: LinearProgressIndicator()),
      );
    }
    final draft = RuleDraft.fromProposal(tool.input);
    final output = tool.output;
    if (tool.state == 'output-available' && output is Map) {
      final accepted = output['action'] == 'accepted';
      return Card(
        margin: EdgeInsets.zero,
        child: ListTile(
          dense: true,
          leading: Icon(accepted ? Icons.check : Icons.close, color: accepted ? Colors.green : theme.colorScheme.outline),
          title: Text(accepted ? 'Rule "${draft.name}" created' : 'Rule rejected'),
        ),
      );
    }

    final c = draft.condition;
    final label = theme.textTheme.labelSmall?.copyWith(
      color: theme.colorScheme.onSurfaceVariant,
      letterSpacing: 0.8,
    );
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Proposed rule: ${draft.name}', style: theme.textTheme.titleSmall),
            const SizedBox(height: 10),
            Text('CONDITION', style: label),
            if (c.from != null) Text('From: ${c.from}'),
            if (c.to != null) Text('To: ${c.to}'),
            if (c.subject != null) Text('Subject: ${c.subject}'),
            if (c.aiInstructions != null) Text('AI: ${c.aiInstructions}'),
            const SizedBox(height: 10),
            Text('ACTIONS', style: label),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final a in draft.actions)
                  Chip(
                    visualDensity: VisualDensity.compact,
                    label: Text(
                      [
                        RuleActionType.describe(a.type),
                        ?a.field('label'),
                        ?a.field('to'),
                        ?a.field('folderName'),
                      ].join(' · '),
                    ),
                  ),
              ],
            ),
            if (canAct) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: busy ? null : onReject,
                      icon: const Icon(Icons.close),
                      label: const Text('Reject'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy ? null : onAccept,
                      icon: busy
                          ? const SizedBox.square(dimension: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.check),
                      label: const Text('Accept'),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}
