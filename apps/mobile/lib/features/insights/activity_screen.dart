import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/insights.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'insights_providers.dart';

/// Rule execution log (web `/app/activity`), with status filter and paging.
class ActivityScreen extends ConsumerStatefulWidget {
  const ActivityScreen({super.key});

  @override
  ConsumerState<ActivityScreen> createState() => _ActivityScreenState();
}

class _ActivityScreenState extends ConsumerState<ActivityScreen> {
  static const _pageSize = 30;
  final _logs = <ExecutionLog>[];
  int _total = 0;
  String? _status;
  bool _loading = true;
  Object? _error;
  String? _mailboxId;

  Future<void> _load({bool reset = false}) async {
    final mailboxId = ref.read(selectedMailboxProvider)?.id;
    if (mailboxId == null) return;
    setState(() {
      _loading = true;
      _error = null;
      if (reset) _logs.clear();
    });
    try {
      final page = await ref
          .read(insightsServiceProvider)
          .executionLogs(mailboxId, limit: _pageSize, offset: _logs.length, status: _status);
      if (!mounted) return;
      setState(() {
        _logs.addAll(page.logs);
        _total = page.total;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mailboxId = ref.watch(selectedMailboxProvider)?.id;
    if (mailboxId != null && mailboxId != _mailboxId) {
      _mailboxId = mailboxId;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load(reset: true));
    }
    return Scaffold(
      drawer: const AppDrawer(selected: 'activity'),
      appBar: AppBar(title: const Text('Activity')),
      body: Column(
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            child: Wrap(
              spacing: 8,
              children: [
                for (final (value, label) in const [(null, 'All'), ('matched', 'Matched'), ('not_matched', 'Not matched'), ('error', 'Errors')])
                  ChoiceChip(
                    label: Text(label),
                    selected: _status == value,
                    onSelected: (_) {
                      setState(() => _status = value);
                      unawaited(_load(reset: true));
                    },
                  ),
              ],
            ),
          ),
          Expanded(
            child: _error != null && _logs.isEmpty
                ? ErrorView(error: _error!, onRetry: () => _load(reset: true))
                : _loading && _logs.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: _logs.isEmpty
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            children: const [
                              SizedBox(
                                height: 360,
                                child: EmptyView(
                                  icon: Icons.history,
                                  title: 'No activity yet',
                                  message: 'Rule runs on incoming mail show up here.',
                                ),
                              ),
                            ],
                          )
                        : ListView.separated(
                            physics: const AlwaysScrollableScrollPhysics(),
                            itemCount: _logs.length + 1,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (context, i) {
                              if (i == _logs.length) {
                                if (_logs.length >= _total) return const SizedBox(height: 32);
                                return Padding(
                                  padding: const EdgeInsets.all(16),
                                  child: Center(
                                    child: _loading
                                        ? const CircularProgressIndicator()
                                        : TextButton(onPressed: _load, child: Text('Load more (${_total - _logs.length} left)')),
                                  ),
                                );
                              }
                              final log = _logs[i];
                              final (icon, color) = switch (log.status) {
                                'matched' => (Icons.check_circle, Colors.green),
                                'error' => (Icons.error, Theme.of(context).colorScheme.error),
                                _ => (Icons.remove_circle_outline, Theme.of(context).colorScheme.outline),
                              };
                              return ListTile(
                                leading: Icon(icon, color: color),
                                title: Text(log.subject ?? '(no subject)', maxLines: 1, overflow: TextOverflow.ellipsis),
                                subtitle: Text(
                                  [
                                    log.ruleName,
                                    if (log.from != null) displayNameFromAddress(log.from!),
                                    if (log.actionsRun.isNotEmpty) log.actionsRun.join(', '),
                                    if (log.error != null) log.error!,
                                  ].join(' · '),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                trailing: Text(formatListDate(log.createdAt), style: Theme.of(context).textTheme.labelSmall),
                                onTap: () => context.push(Routes.messagePath(log.messageId)),
                              );
                            },
                          ),
                  ),
          ),
        ],
      ),
    );
  }
}
