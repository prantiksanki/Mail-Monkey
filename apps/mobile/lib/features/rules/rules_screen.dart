import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/rule.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'rule_tools.dart';

/// Rules list (web `/app/rules`): toggle, edit, test, apply to past mail,
/// delete, AI-generated suggestions and "describe a rule".
class RulesScreen extends ConsumerWidget {
  const RulesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      drawer: const AppDrawer(selected: 'rules'),
      appBar: AppBar(
        title: const Text('Rules'),
        actions: [
          IconButton(
            tooltip: 'Rules assistant',
            icon: const Icon(Icons.auto_awesome_outlined),
            onPressed: () => context.push(Routes.rulesAssistant),
          ),
          if (mailbox != null)
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'apply') unawaited(runApplyToRecent(context, ref, mailbox.id));
                if (v == 'suggest') unawaited(showRuleSuggestions(context, ref, mailbox.id));
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'suggest', child: Text('Suggested rules')),
                PopupMenuItem(value: 'apply', child: Text('Run rules on recent mail')),
              ],
            ),
        ],
      ),
      floatingActionButton: mailbox == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => showNewRuleMenu(context, ref, mailbox.id),
              icon: const Icon(Icons.add),
              label: const Text('New rule'),
            ),
      body: mailbox == null
          ? const EmptyView(icon: Icons.rule, title: 'Connect a mailbox to create rules')
          : ref.watch(rulesProvider(mailbox.id)).when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(rulesProvider(mailbox.id))),
              data: (rules) => RefreshIndicator(
                onRefresh: () => ref.refresh(rulesProvider(mailbox.id).future),
                child: rules.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: [
                          SizedBox(
                            height: 420,
                            child: EmptyView(
                              icon: Icons.rule,
                              title: 'No rules yet',
                              message: 'Rules sort, label and reply to email for you as it arrives.',
                              action: FilledButton.tonalIcon(
                                onPressed: () => showRuleSuggestions(context, ref, mailbox.id),
                                icon: const Icon(Icons.lightbulb_outline),
                                label: const Text('See suggestions'),
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 96),
                        itemCount: rules.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) => _RuleTile(mailboxId: mailbox.id, rule: rules[i]),
                      ),
              ),
            ),
    );
  }
}

class _RuleTile extends ConsumerStatefulWidget {
  const _RuleTile({required this.mailboxId, required this.rule});

  final String mailboxId;
  final Rule rule;

  @override
  ConsumerState<_RuleTile> createState() => _RuleTileState();
}

class _RuleTileState extends ConsumerState<_RuleTile> {
  bool? _enabled;

  Future<void> _toggle(bool value) async {
    setState(() => _enabled = value);
    try {
      await ref.read(rulesServiceProvider).toggle(widget.mailboxId, widget.rule.id, enabled: value);
      ref.invalidate(rulesProvider(widget.mailboxId));
    } catch (e) {
      if (!mounted) return;
      setState(() => _enabled = !value);
      showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _delete() async {
    final ok = await confirmAction(
      context,
      title: 'Delete rule?',
      message: '"${widget.rule.name}" will stop running. Emails it already sorted stay where they are.',
    );
    if (!ok) return;
    try {
      await ref.read(rulesServiceProvider).delete(widget.mailboxId, widget.rule.id);
      ref.invalidate(rulesProvider(widget.mailboxId));
      if (mounted) showMessage(context, 'Rule deleted');
    } catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final rule = widget.rule;
    final enabled = _enabled ?? rule.enabled;
    final summary = describeRule(rule);
    return ListTile(
      title: Text(rule.name),
      subtitle: Text(summary, maxLines: 2, overflow: TextOverflow.ellipsis),
      onTap: () => context.push(Routes.ruleEdit, extra: rule),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Switch(value: enabled, onChanged: _toggle),
          PopupMenuButton<String>(
            onSelected: (v) {
              switch (v) {
                case 'edit':
                  unawaited(context.push(Routes.ruleEdit, extra: rule));
                case 'test':
                  unawaited(showRuleTest(context, ref, widget.mailboxId, rule));
                case 'backfill':
                  unawaited(showBackfill(context, ref, widget.mailboxId, rule));
                case 'delete':
                  unawaited(_delete());
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'edit', child: Text('Edit')),
              PopupMenuItem(value: 'test', child: Text('Test on recent mail')),
              PopupMenuItem(value: 'backfill', child: Text('Apply to past mail')),
              PopupMenuItem(value: 'delete', child: Text('Delete')),
            ],
          ),
        ],
      ),
    );
  }
}

/// One-line human summary of a rule's condition and actions.
String describeRule(Rule rule) {
  final c = rule.condition;
  final parts = <String>[
    if (c.aiInstructions?.isNotEmpty ?? false) 'AI: ${c.aiInstructions}',
    if (c.from?.isNotEmpty ?? false) 'from ${c.from}',
    if (c.to?.isNotEmpty ?? false) 'to ${c.to}',
    if (c.subject?.isNotEmpty ?? false) 'subject "${c.subject}"',
  ];
  final actions = rule.actions.map((a) {
    final label = a.field('label');
    return a.type == RuleActionType.label && label != null
        ? 'label "$label"'
        : RuleActionType.describe(a.type).toLowerCase();
  }).join(', ');
  final when = parts.isEmpty ? 'Every email' : parts.join(c.operator == 'OR' ? ' or ' : ' and ');
  return actions.isEmpty ? when : '$when → $actions';
}
