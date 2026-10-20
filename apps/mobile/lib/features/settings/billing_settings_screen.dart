import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/config/env.dart';
import '../../models/account.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/state_views.dart';
import 'settings_providers.dart';
import 'settings_widgets.dart';

class _Price {
  const _Price(this.productId, this.interval, this.amount);

  final String productId;
  final String interval;
  final int amount;
}

class _Plan {
  const _Plan(this.id, this.name, this.features, this.prices, {this.recommended = false});

  final String id;
  final String name;
  final List<String> features;
  final List<_Price> prices;
  final bool recommended;
}

/// Mirrors packages/payments/config.ts (USD, 7-day trial). Product IDs come
/// from `--dart-define` like the web's `NEXT_PUBLIC_PRICE_ID_*`.
const _plans = [
  _Plan('starter', 'Starter', ['Up to 3 mailboxes', 'Unlimited rules', '3,000 emails processed / month', 'AI chat'], [
    _Price(Env.priceStarterMonthly, 'month', 4),
    _Price(Env.priceStarterYearly, 'year', 36),
  ]),
  _Plan(
    'pro',
    'Pro',
    [
      'Unlimited rules',
      '15,000 emails processed / month',
      'AI chat and auto-drafts',
      'Calendar scheduling and meeting integrations',
      '300 voice-agent minutes / month',
    ],
    [_Price(Env.priceProMonthly, 'month', 10), _Price(Env.priceProYearly, 'year', 108)],
    recommended: true,
  ),
];

/// Settings → Billing (web ActivePlan + ChangePlan). Checkout and the
/// customer portal open in the browser, like the web.
class BillingSettingsScreen extends ConsumerStatefulWidget {
  const BillingSettingsScreen({super.key});

  @override
  ConsumerState<BillingSettingsScreen> createState() => _BillingSettingsScreenState();
}

class _BillingSettingsScreenState extends ConsumerState<BillingSettingsScreen> {
  String _interval = 'month';

  /// Same rules as packages/payments/lib/helper.ts.
  static ({Purchase purchase, _Plan? plan, _Price? price})? _active(List<Purchase> purchases) {
    final now = DateTime.now();
    bool active(Purchase p) =>
        p.status != 'expired' &&
        p.status != 'canceled' &&
        !(p.isTrial && p.trialEndsAt != null && !p.trialEndsAt!.isAfter(now));
    final purchase = purchases.where((p) => p.type == 'SUBSCRIPTION' && active(p)).firstOrNull ??
        purchases.where((p) => p.type == 'ONE_TIME').firstOrNull;
    if (purchase == null) return null;
    for (final plan in _plans) {
      for (final price in plan.prices) {
        if (price.productId.isNotEmpty && price.productId == purchase.productId) {
          return (purchase: purchase, plan: plan, price: price);
        }
      }
    }
    return (purchase: purchase, plan: null, price: null);
  }

  Future<void> _open(Future<String> Function() link) async {
    try {
      final url = await link();
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _startTrial() async {
    try {
      final ends = await ref.read(billingServiceProvider).startTrial();
      ref.invalidate(purchasesProvider);
      if (mounted) showMessage(context, 'Trial started${ends == null ? '' : ' — ends ${formatFullDate(ends)}'}');
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final billing = ref.read(billingServiceProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Billing')),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(purchasesProvider.future),
        child: ref.watch(purchasesProvider).when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(purchasesProvider)),
          data: (purchases) {
            final current = _active(purchases);
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                SettingsSection(
                  title: 'Your plan',
                  child: current == null
                      ? const Text('No active plan.')
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(current.plan?.name ?? 'Subscription', style: Theme.of(context).textTheme.titleLarge),
                            if (current.price != null)
                              Text('\$${current.price!.amount} / ${current.price!.interval}'),
                            Text(
                              current.purchase.isTrial
                                  ? 'Trial${current.purchase.trialEndsAt == null ? '' : ' until ${formatFullDate(current.purchase.trialEndsAt)}'}'
                                  : 'Status: ${current.purchase.status ?? 'active'}',
                            ),
                            if (!current.purchase.isTrial) ...[
                              const SizedBox(height: 8),
                              OutlinedButton.icon(
                                onPressed: () => _open(() => billing.customerPortalLink(current.purchase.id)),
                                icon: const Icon(Icons.open_in_new),
                                label: const Text('Manage billing'),
                              ),
                            ],
                          ],
                        ),
                ),
                SettingsSection(
                  title: 'Change plan',
                  description: 'All plans include a 7-day free trial.',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'month', label: Text('Monthly')),
                          ButtonSegment(value: 'year', label: Text('Yearly')),
                        ],
                        selected: {_interval},
                        onSelectionChanged: (s) => setState(() => _interval = s.first),
                      ),
                      const SizedBox(height: 12),
                      for (final plan in _plans) _planCard(plan, isCurrent: current?.plan?.id == plan.id),
                      if (purchases.isEmpty) ...[
                        const SizedBox(height: 8),
                        BusyButton(label: 'Start free trial', tonal: true, onPressed: _startTrial),
                      ],
                    ],
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _planCard(_Plan plan, {required bool isCurrent}) {
    final price = plan.prices.firstWhere((p) => p.interval == _interval);
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: plan.recommended ? theme.colorScheme.primary : theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(plan.name, style: theme.textTheme.titleMedium),
                if (plan.recommended) ...[
                  const SizedBox(width: 8),
                  const Chip(label: Text('Recommended'), visualDensity: VisualDensity.compact),
                ],
                const Spacer(),
                Text('\$${price.amount} / ${price.interval}', style: theme.textTheme.titleSmall),
              ],
            ),
            for (final f in plan.features) Text('• $f'),
            const SizedBox(height: 8),
            if (isCurrent)
              const Text('Current plan')
            else if (price.productId.isEmpty)
              const BlockedNotice('Checkout is not configured for this build (missing price ID).')
            else
              FilledButton(
                onPressed: () => _open(
                  () => ref.read(billingServiceProvider).checkoutLink(productId: price.productId),
                ),
                child: Text('Choose ${plan.name}'),
              ),
          ],
        ),
      ),
    );
  }
}
