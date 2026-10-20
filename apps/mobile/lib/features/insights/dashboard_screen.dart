import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/charts.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'insights_providers.dart';

const _categoryNames = {
  'PRIMARY': 'Primary',
  'NEWSLETTER': 'Newsletters',
  'PROMOTION': 'Promotions',
  'SOCIAL': 'Social',
};

/// Mailbox dashboard (web `/app`): AI insight, inbox-zero progress,
/// categories, rule activity and top senders.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      drawer: const AppDrawer(selected: 'dashboard'),
      appBar: AppBar(title: const Text('Dashboard')),
      body: mailbox == null
          ? const EmptyView(icon: Icons.dashboard_outlined, title: 'Connect a mailbox to see your dashboard')
          : RefreshIndicator(
              onRefresh: () async {
                ref
                  ..invalidate(dashboardProvider(mailbox.id))
                  ..invalidate(statsProvider(mailbox.id));
                await ref.read(dashboardProvider(mailbox.id).future);
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  ref.watch(dashboardProvider(mailbox.id)).when(
                    loading: () => const Padding(padding: EdgeInsets.all(48), child: Center(child: CircularProgressIndicator())),
                    error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(dashboardProvider(mailbox.id))),
                    data: (d) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (d.aiInsight.isNotEmpty)
                          Card(
                            margin: EdgeInsets.zero,
                            color: Theme.of(context).colorScheme.primaryContainer,
                            child: ListTile(
                              leading: const Icon(Icons.auto_awesome),
                              title: const Text('AI insight'),
                              subtitle: Text(d.aiInsight),
                            ),
                          ),
                        const SizedBox(height: 12),
                        StatGrid(
                          children: [
                            StatTile(
                              icon: Icons.check_circle_outline,
                              label: 'Inbox zero',
                              value: '${d.inboxZeroPercent.round()}%',
                            ),
                            StatTile(
                              icon: Icons.priority_high,
                              label: 'Priority emails',
                              value: '${d.priorityCount}',
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SectionCard(
                          title: 'Categories',
                          child: RankedBars(
                            items: [
                              for (final e in d.categories.entries)
                                (label: _categoryNames[e.key] ?? e.key, value: e.value),
                              if (d.uncategorizedCount > 0)
                                (label: 'Not yet categorized', value: d.uncategorizedCount),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        SectionCard(
                          title: 'Top senders',
                          child: RankedBars(
                            items: [
                              for (final s in d.topSenders)
                                (label: s.from.isNotEmpty ? s.from : s.fromEmail, value: s.count),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  ref.watch(statsProvider(mailbox.id)).when(
                    loading: () => const SizedBox.shrink(),
                    error: (_, _) => const SizedBox.shrink(),
                    data: (s) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        StatGrid(
                          children: [
                            StatTile(label: 'Processed today', value: '${s.processedToday}', caption: 'Yesterday ${s.processedYesterday}'),
                            StatTile(label: 'Rules fired today', value: '${s.firedToday}', caption: 'Yesterday ${s.firedYesterday}'),
                            StatTile(label: 'Errors today', value: '${s.errorsToday}'),
                            StatTile(label: 'Active rules', value: '${s.rulesActive}/${s.rulesTotal}'),
                          ],
                        ),
                        const SizedBox(height: 12),
                        SectionCard(
                          title: 'Last 7 days',
                          child: BarChart(
                            labels: [for (final p in s.sparkline) p.day.length >= 10 ? p.day.substring(5) : p.day],
                            primary: [for (final p in s.sparkline) p.processed],
                            secondary: [for (final p in s.sparkline) p.fired],
                            primaryLabel: 'Processed',
                            secondaryLabel: 'Rules fired',
                          ),
                        ),
                        const SizedBox(height: 12),
                        SectionCard(
                          title: 'Top rules this week',
                          trailing: TextButton(onPressed: () => context.go(Routes.rules), child: const Text('All rules')),
                          child: RankedBars(items: [for (final r in s.topRules) (label: r.name, value: r.count)]),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
    );
  }
}
