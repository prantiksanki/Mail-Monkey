import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/mailbox.dart';
import '../../models/rule.dart';
import '../../shared/widgets/state_views.dart';
import '../insights/insights_providers.dart';
import '../mail/mail_providers.dart';
import 'settings_widgets.dart';

/// Settings → Mailboxes (web MailboxesPage + IntegrationsSettings mailbox
/// list): health, pause/resume processing, re-classify, diagnostics,
/// disconnect and custom-email (IMAP) connection.
class MailboxesSettingsScreen extends ConsumerWidget {
  const MailboxesSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(title: const Text('Mailboxes')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => context.push(Routes.connectMailbox),
      icon: const Icon(Icons.add),
      label: const Text('Custom email'),
    ),
    body: RefreshIndicator(
      onRefresh: () => ref.refresh(mailboxesProvider.future),
      child: ref.watch(mailboxesProvider).when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(mailboxesProvider)),
        data: (list) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            if (list.isEmpty)
              const EmptyView(icon: Icons.mail_outline, title: 'No mailboxes connected'),
            for (final m in list) _MailboxCard(mailbox: m),
            const BlockedNotice(
              'Gmail and Outlook mailboxes are connected by signing in with that account. Linking an additional '
              'Gmail or Outlook mailbox to an existing account needs a browser session and is only available on the web.',
            ),
          ],
        ),
      ),
    ),
  );
}

class _MailboxCard extends ConsumerStatefulWidget {
  const _MailboxCard({required this.mailbox});

  final Mailbox mailbox;

  @override
  ConsumerState<_MailboxCard> createState() => _MailboxCardState();
}

class _MailboxCardState extends ConsumerState<_MailboxCard> {
  bool _busy = false;
  BackgroundRun? _classification;

  Mailbox get m => widget.mailbox;

  Future<void> _toggleWatch(bool enable) async {
    setState(() => _busy = true);
    final insights = ref.read(insightsServiceProvider);
    try {
      await (enable ? insights.enableWatch(m.id) : insights.disableWatch(m.id));
      ref.invalidate(mailboxesProvider);
      if (mounted) showMessage(context, enable ? 'Processing resumed' : 'Processing paused');
    } on Exception {
      if (mounted) showMessage(context, "Couldn't update processing for this mailbox", error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Re-runs AI categorisation over the mailbox, advancing the server-side
  /// run in steps until it finishes.
  Future<void> _classify() async {
    final insights = ref.read(insightsServiceProvider);
    try {
      var run = await insights.classificationStatus(m.id);
      if (run == null || run.isDone) run = await insights.startClassification(m.id);
      while (mounted && run != null && !run.isDone) {
        setState(() => _classification = run);
        run = await insights.advanceClassification(m.id, run.id) ?? run;
        await Future<void>.delayed(const Duration(milliseconds: 500));
      }
      if (!mounted) return;
      setState(() => _classification = run);
      ref.invalidate(labelCountsProvider(m.id));
      showMessage(
        context,
        run?.status == 'failed' ? 'Categorisation failed: ${run?.lastError ?? ''}' : 'Categorisation complete',
        error: run?.status == 'failed',
      );
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _diagnose({required bool extended}) async {
    setState(() => _busy = true);
    try {
      final report = await ref.read(insightsServiceProvider).diagnose(m.id, extended: extended);
      if (!mounted) return;
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (context) => DraggableScrollableSheet(
          expand: false,
          builder: (context, scroll) => ListView(
            controller: scroll,
            padding: const EdgeInsets.all(16),
            children: [
              Text('Diagnostics · ${m.email}', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 12),
              SelectableText(
                const JsonEncoder.withIndent('  ').convert(report),
                style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
              ),
            ],
          ),
        ),
      );
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _disconnect() async {
    final ok = await confirmAction(
      context,
      title: 'Disconnect ${m.email}?',
      message:
          "All rules and execution history for this mailbox will be permanently deleted. Mail Monkey's access to "
          'this inbox will be revoked. You can reconnect at any time.',
      confirmLabel: 'Disconnect',
    );
    if (!ok) return;
    try {
      await ref.read(mailServiceProvider).disconnect(m.id);
      ref.invalidate(mailboxesProvider);
      if (mounted) showMessage(context, '${m.email} has been disconnected');
    } on Exception {
      if (mounted) showMessage(context, 'Failed to disconnect mailbox. Please try again.', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (healthLabel, healthColor) = switch (m.health) {
      'reconnect' => ('Reauth needed', theme.colorScheme.error),
      'attention' => ('Processing paused', theme.colorScheme.tertiary),
      _ => ('Healthy', Colors.green),
    };
    final run = _classification;
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 8, 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: CircleAvatar(child: Icon(m.isImap ? Icons.dns_outlined : Icons.alternate_email)),
              title: Text(m.email, overflow: TextOverflow.ellipsis),
              subtitle: Text('${m.providerLabel} · $healthLabel', style: TextStyle(color: healthColor)),
              trailing: PopupMenuButton<String>(
                enabled: !_busy,
                onSelected: (v) => switch (v) {
                  'classify' => _classify(),
                  'diagnose' => _diagnose(extended: false),
                  'diagnose-extended' => _diagnose(extended: true),
                  _ => _disconnect(),
                },
                itemBuilder: (_) => const [
                  PopupMenuItem(value: 'classify', child: Text('Re-run categorisation')),
                  PopupMenuItem(value: 'diagnose', child: Text('Run diagnostics')),
                  PopupMenuItem(value: 'diagnose-extended', child: Text('Extended diagnostics')),
                  PopupMenuItem(value: 'disconnect', child: Text('Disconnect')),
                ],
              ),
            ),
            if (!m.isImap)
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Process new email'),
                subtitle: const Text('Run rules and AI on incoming mail'),
                value: m.watchEnabled,
                onChanged: _busy ? null : _toggleWatch,
              ),
            if (m.health == 'reconnect')
              const BlockedNotice('Sign in with this account again (on the web) to renew access.'),
            if (!m.emailSyncComplete) Text('Initial sync in progress…', style: theme.textTheme.bodySmall),
            if (run != null && !run.isDone) ...[
              const SizedBox(height: 8),
              Text('Categorising… ${run.processedCount}${run.total == null ? '' : ' / ${run.total}'}'),
              LinearProgressIndicator(value: run.progress),
            ],
          ],
        ),
      ),
    );
  }
}
