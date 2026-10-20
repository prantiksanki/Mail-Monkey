import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/rule.dart';
import '../../shared/widgets/state_views.dart';
import '../insights/insights_providers.dart';
import '../mail/mail_providers.dart';

/// Starter templates (web RulesTemplates), opened in the editor to review.
const _templates = {
  'newsletters': RuleDraft(
    name: 'Archive newsletters',
    condition: RuleCondition(aiInstructions: 'newsletter or marketing email'),
    actions: [
      RuleAction(type: RuleActionType.archive),
      RuleAction(type: RuleActionType.label, fields: {'label': 'Newsletter'}),
    ],
  ),
  'receipts': RuleDraft(
    name: 'Label receipts',
    condition: RuleCondition(aiInstructions: 'receipt, invoice, or order confirmation'),
    actions: [
      RuleAction(type: RuleActionType.label, fields: {'label': 'Finance'}),
    ],
  ),
};

/// "New rule" entry point: write it yourself, describe it to the AI, or pick
/// a suggestion — the same options as the web Rules page.
Future<void> showNewRuleMenu(BuildContext context, WidgetRef ref, String mailboxId) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    showDragHandle: true,
    builder: (context) => SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.auto_awesome),
            title: const Text('Describe it'),
            subtitle: const Text('Write what you want in plain English'),
            onTap: () => Navigator.of(context).pop('describe'),
          ),
          ListTile(
            leading: const Icon(Icons.lightbulb_outline),
            title: const Text('Suggested rules'),
            subtitle: const Text('Based on your recent email'),
            onTap: () => Navigator.of(context).pop('suggest'),
          ),
          ListTile(
            leading: const Icon(Icons.forum_outlined),
            title: const Text('Chat with the rules assistant'),
            onTap: () => Navigator.of(context).pop('assistant'),
          ),
          ListTile(
            leading: const Icon(Icons.archive_outlined),
            title: const Text('Template: Archive newsletters'),
            onTap: () => Navigator.of(context).pop('tpl:newsletters'),
          ),
          ListTile(
            leading: const Icon(Icons.receipt_long_outlined),
            title: const Text('Template: Label receipts'),
            onTap: () => Navigator.of(context).pop('tpl:receipts'),
          ),
          ListTile(
            leading: const Icon(Icons.tune),
            title: const Text('Build it manually'),
            onTap: () => Navigator.of(context).pop('manual'),
          ),
        ],
      ),
    ),
  );
  if (!context.mounted) return;
  switch (choice) {
    case 'describe':
      await _describeRule(context, ref, mailboxId);
    case 'suggest':
      await showRuleSuggestions(context, ref, mailboxId);
    case 'assistant':
      await context.push(Routes.rulesAssistant);
      ref.invalidate(rulesProvider(mailboxId));
    case final String c when c.startsWith('tpl:'):
      await context.push(Routes.ruleEdit, extra: _templates[c.substring(4)]);
      ref.invalidate(rulesProvider(mailboxId));
    case 'manual':
      await context.push(Routes.ruleEdit);
  }
}

Future<void> _describeRule(BuildContext context, WidgetRef ref, String mailboxId) async {
  final controller = TextEditingController();
  final prompt = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Describe your rule'),
      content: TextField(
        controller: controller,
        autofocus: true,
        minLines: 3,
        maxLines: 6,
        decoration: const InputDecoration(
          hintText: 'e.g. Label invoices from vendors as "Finance" and archive newsletters',
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        FilledButton(
          style: FilledButton.styleFrom(minimumSize: const Size(0, 40)),
          onPressed: () => Navigator.of(context).pop(controller.text.trim()),
          child: const Text('Create'),
        ),
      ],
    ),
  );
  controller.dispose();
  if (prompt == null || prompt.isEmpty || !context.mounted) return;

  showMessage(context, 'Creating rules with AI…');
  try {
    final drafts = await ref.read(rulesServiceProvider).compile(mailboxId, prompt);
    if (!context.mounted) return;
    if (drafts.isEmpty) {
      showMessage(context, 'The AI couldn\'t turn that into a rule. Try rephrasing.', error: true);
      return;
    }
    // Review each generated rule in the editor before saving.
    for (final draft in drafts) {
      if (!context.mounted) return;
      await context.push(Routes.ruleEdit, extra: draft);
    }
    ref.invalidate(rulesProvider(mailboxId));
  } catch (e) {
    if (context.mounted) showMessage(context, errorMessage(e), error: true);
  }
}

Future<void> showRuleSuggestions(BuildContext context, WidgetRef ref, String mailboxId) =>
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        builder: (context, scroll) => FutureBuilder<List<RuleSuggestion>>(
          future: ref.read(rulesServiceProvider).suggestions(mailboxId).then((items) {
            // Once-per-user "first summary viewed" telemetry, deduped
            // server-side (web InboxIntelligencePage).
            if (items.isNotEmpty) {
              unawaited(ref.read(insightsServiceProvider).markFirstSummaryViewed().catchError((Object _) {}));
            }
            return items;
          }),
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorView(error: snapshot.error!);
            if (!snapshot.hasData) return const Center(child: CircularProgressIndicator());
            final items = snapshot.data!;
            if (items.isEmpty) {
              return const EmptyView(icon: Icons.lightbulb_outline, title: 'No suggestions right now');
            }
            return ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                Text('Suggested rules', style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                for (final s in items)
                  Card(
                    child: ListTile(
                      title: Text(s.title),
                      subtitle: Text('${s.description}\n${s.reason} · ~${s.estimatedMatches} emails'),
                      isThreeLine: true,
                      trailing: const Icon(Icons.add_circle_outline),
                      onTap: () async {
                        Navigator.of(context).pop();
                        await context.push(Routes.ruleEdit, extra: s.rule);
                        ref.invalidate(rulesProvider(mailboxId));
                      },
                    ),
                  ),
              ],
            );
          },
        ),
      ),
    );

Future<void> showRuleTest(BuildContext context, WidgetRef ref, String mailboxId, Rule rule) =>
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.7,
        builder: (context, scroll) => FutureBuilder(
          future: ref.read(rulesServiceProvider).test(mailboxId, rule.id),
          builder: (context, snapshot) {
            if (snapshot.hasError) return ErrorView(error: snapshot.error!);
            if (!snapshot.hasData) {
              return const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [CircularProgressIndicator(), SizedBox(height: 12), Text('Testing on recent mail…')],
                ),
              );
            }
            final result = snapshot.data!;
            return ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              children: [
                Text('"${rule.name}" would match ${result.matchCount} of ${result.total} recent emails',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                for (final r in result.results)
                  ListTile(
                    leading: Icon(
                      r.matched ? Icons.check_circle : Icons.radio_button_unchecked,
                      color: r.matched ? Colors.green : Theme.of(context).colorScheme.outline,
                    ),
                    title: Text(r.subject, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text(r.from, maxLines: 1, overflow: TextOverflow.ellipsis),
                  ),
              ],
            );
          },
        ),
      ),
    );

/// Applies one rule to older mail, advancing the server-side run in steps
/// until it finishes (the web drives backfill the same way).
Future<void> showBackfill(BuildContext context, WidgetRef ref, String mailboxId, Rule rule) async {
  final months = await showDialog<int>(
    context: context,
    builder: (context) => SimpleDialog(
      title: Text('Apply "${rule.name}" to past mail'),
      children: [
        for (final m in const [1, 3, 6, 12])
          SimpleDialogOption(
            onPressed: () => Navigator.of(context).pop(m),
            child: Text('Last $m month${m == 1 ? '' : 's'}'),
          ),
      ],
    ),
  );
  if (months == null || !context.mounted) return;
  await showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (_) => _BackfillDialog(mailboxId: mailboxId, rule: rule, months: months),
  );
}

class _BackfillDialog extends ConsumerStatefulWidget {
  const _BackfillDialog({required this.mailboxId, required this.rule, required this.months});

  final String mailboxId;
  final Rule rule;
  final int months;

  @override
  ConsumerState<_BackfillDialog> createState() => _BackfillDialogState();
}

class _BackfillDialogState extends ConsumerState<_BackfillDialog> {
  BackgroundRun? _run;
  Object? _error;
  bool _stopped = false;

  @override
  void initState() {
    super.initState();
    unawaited(_drive());
  }

  Future<void> _drive() async {
    final rules = ref.read(rulesServiceProvider);
    try {
      var run = await rules.startBackfill(widget.mailboxId, widget.rule.id, windowMonths: widget.months);
      while (mounted && !_stopped && run != null && !run.isDone) {
        setState(() => _run = run);
        run = await rules.advanceBackfill(widget.mailboxId, run.id) ?? run;
      }
      if (mounted) setState(() => _run = run);
      ref.invalidate(labelCountsProvider(widget.mailboxId));
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final run = _run;
    final done = _error != null || (run?.isDone ?? false) || _stopped;
    return AlertDialog(
      title: Text(done ? 'Done' : 'Applying "${widget.rule.name}"…'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_error != null) Text(errorMessage(_error!))
          else ...[
            LinearProgressIndicator(value: done ? 1 : run?.progress),
            const SizedBox(height: 12),
            Text(
              run == null
                  ? 'Starting…'
                  : '${run.processedCount}${run.total != null ? ' of ${run.total}' : ''} emails checked · '
                        '${run.matchedCount} matched · ${run.appliedCount} updated'
                        '${run.errorCount > 0 ? ' · ${run.errorCount} errors' : ''}',
            ),
            if (run?.lastError != null) ...[const SizedBox(height: 8), Text(run!.lastError!)],
          ],
        ],
      ),
      actions: [
        if (!done) TextButton(onPressed: () => setState(() => _stopped = true), child: const Text('Stop')),
        if (done) TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Close')),
      ],
    );
  }
}

Future<void> runApplyToRecent(BuildContext context, WidgetRef ref, String mailboxId) async {
  showMessage(context, 'Running your rules on recent mail…');
  try {
    final results = await ref.read(rulesServiceProvider).applyToRecent(mailboxId);
    ref.invalidate(labelCountsProvider(mailboxId));
    if (!context.mounted) return;
    final applied = results.where((r) => r.status == 'applied').length;
    final errors = results.where((r) => r.status == 'error').length;
    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        builder: (context, scroll) => ListView(
          controller: scroll,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
          children: [
            Text('$applied of ${results.length} emails updated${errors > 0 ? ' · $errors errors' : ''}',
                style: Theme.of(context).textTheme.titleMedium),
            for (final r in results)
              ListTile(
                leading: Icon(switch (r.status) {
                  'applied' => Icons.check_circle,
                  'error' => Icons.error_outline,
                  _ => Icons.remove_circle_outline,
                }),
                title: Text(r.subject, maxLines: 1, overflow: TextOverflow.ellipsis),
                subtitle: Text(
                  r.matchedRuleName != null ? '${r.matchedRuleName}: ${r.actions.join(', ')}' : (r.error ?? 'No rule matched'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
          ],
        ),
      ),
    );
  } catch (e) {
    if (context.mounted) showMessage(context, errorMessage(e), error: true);
  }
}
