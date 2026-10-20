import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/charts.dart';
import '../../shared/widgets/state_views.dart';
import 'insights_providers.dart';

/// Account-wide automation analytics (web `/app/analytics`).
class AnalyticsScreen extends ConsumerStatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  ConsumerState<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends ConsumerState<AnalyticsScreen> {
  int _days = 30;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      drawer: const AppDrawer(selected: 'analytics'),
      appBar: AppBar(title: const Text('Analytics')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref
            ..invalidate(overviewProvider)
            ..invalidate(volumeProvider(_days))
            ..invalidate(topSendersProvider);
          await ref.read(overviewProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            ref.watch(overviewProvider).when(
              loading: () => const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(overviewProvider)),
              data: (o) => StatGrid(
                children: [
                  StatTile(icon: Icons.mail_outline, label: 'Emails processed', value: '${o.totalEmailsProcessed}'),
                  StatTile(
                    icon: Icons.bolt_outlined,
                    label: 'Automation success',
                    value: '${(o.successRate <= 1 ? o.successRate * 100 : o.successRate).round()}%',
                    caption: '${o.matched} matched · ${o.errors} errors',
                  ),
                  StatTile(icon: Icons.rule, label: 'Active rules', value: '${o.activeRules}', caption: 'of ${o.totalRules}'),
                ],
              ),
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: 'Email volume',
              trailing: SegmentedButton<int>(
                showSelectedIcon: false,
                segments: const [
                  ButtonSegment(value: 7, label: Text('7d')),
                  ButtonSegment(value: 30, label: Text('30d')),
                  ButtonSegment(value: 90, label: Text('90d')),
                ],
                selected: {_days},
                onSelectionChanged: (s) => setState(() => _days = s.first),
              ),
              child: ref.watch(volumeProvider(_days)).when(
                loading: () => const SizedBox(height: 160, child: Center(child: CircularProgressIndicator())),
                error: (e, _) => Text(errorMessage(e)),
                data: (points) => points.isEmpty
                    ? const Text('No data yet')
                    : BarChart(
                        labels: [for (final p in points) p.date.length >= 10 ? p.date.substring(5) : p.date],
                        primary: [for (final p in points) p.total],
                        secondary: [for (final p in points) p.matched],
                        primaryLabel: 'Received',
                        secondaryLabel: 'Matched a rule',
                      ),
              ),
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: 'Top senders',
              child: ref.watch(topSendersProvider).when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Text(errorMessage(e)),
                data: (senders) => RankedBars(items: [for (final s in senders) (label: s.sender, value: s.count)]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
