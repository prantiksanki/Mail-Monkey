import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../models/payment_card.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'bills_providers.dart';

/// Payments board (web /app/bills KanbanBoard): one tab per column, with the
/// same mailbox/type/search filters. Cards move between columns from their
/// menu instead of drag-and-drop.
class BillsScreen extends ConsumerStatefulWidget {
  const BillsScreen({super.key});

  @override
  ConsumerState<BillsScreen> createState() => _BillsScreenState();
}

class _BillsScreenState extends ConsumerState<BillsScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  String? _mailboxId;
  String? _paymentType;
  String _query = '';

  BillFilters get _filters => BillFilters(
    mailboxId: _mailboxId,
    paymentType: _paymentType,
    search: _query.isEmpty ? null : _query,
  );

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () => setState(() => _query = value.trim()));
  }

  Future<void> _move(PaymentCard card, String status) async {
    try {
      await ref.read(billsProvider(_filters).notifier).moveTo(card.id, status);
    } on Exception catch (e) {
      if (mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final mailboxes = ref.watch(mailboxesProvider).value ?? const [];
    final bills = ref.watch(billsProvider(_filters));
    final grouped = bills.value?.byStatus;

    return DefaultTabController(
      length: PaymentStatus.all.length,
      child: Scaffold(
        drawer: const AppDrawer(selected: 'bills'),
        appBar: AppBar(
          title: const Text('Payments'),
          bottom: TabBar(
            isScrollable: true,
            tabAlignment: TabAlignment.start,
            tabs: [
              for (final s in PaymentStatus.all)
                Tab(
                  text: grouped == null
                      ? PaymentStatus.label(s)
                      : '${PaymentStatus.label(s)} (${grouped[s]!.length})',
                ),
            ],
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
              child: TextField(
                controller: _search,
                onChanged: _onSearch,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  hintText: 'Search merchant or subject…',
                  isDense: true,
                ),
              ),
            ),
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                children: [
                  if (mailboxes.length > 1) ...[
                    DropdownButton<String?>(
                      value: _mailboxId,
                      underline: const SizedBox.shrink(),
                      items: [
                        const DropdownMenuItem(child: Text('All mailboxes')),
                        for (final m in mailboxes) DropdownMenuItem(value: m.id, child: Text(m.email)),
                      ],
                      onChanged: (v) => setState(() => _mailboxId = v),
                    ),
                    const SizedBox(width: 8),
                  ],
                  ChoiceChip(
                    label: const Text('All'),
                    selected: _paymentType == null,
                    onSelected: (_) => setState(() => _paymentType = null),
                  ),
                  for (final e in paymentTypeLabels.entries) ...[
                    const SizedBox(width: 6),
                    ChoiceChip(
                      label: Text(e.value),
                      selected: _paymentType == e.key,
                      onSelected: (_) => setState(() => _paymentType = e.key),
                    ),
                  ],
                ],
              ),
            ),
            Expanded(
              child: bills.when(
                skipLoadingOnReload: true,
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(billsProvider(_filters))),
                data: (state) => TabBarView(
                  children: [
                    for (final status in PaymentStatus.all)
                      _Column(
                        cards: state.byStatus[status]!,
                        status: status,
                        hasMore: state.nextCursor != null,
                        loadingMore: state.loadingMore,
                        onRefresh: () => ref.refresh(billsProvider(_filters).future),
                        onLoadMore: () => ref.read(billsProvider(_filters).notifier).loadMore(),
                        onMove: _move,
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Column extends StatelessWidget {
  const _Column({
    required this.cards,
    required this.status,
    required this.hasMore,
    required this.loadingMore,
    required this.onRefresh,
    required this.onLoadMore,
    required this.onMove,
  });

  final List<PaymentCard> cards;
  final String status;
  final bool hasMore;
  final bool loadingMore;
  final Future<void> Function() onRefresh;
  final Future<void> Function() onLoadMore;
  final Future<void> Function(PaymentCard card, String status) onMove;

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: onRefresh,
    child: ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(12),
      children: [
        if (cards.isEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 48),
            child: EmptyView(
              icon: Icons.receipt_long_outlined,
              title: 'Nothing ${PaymentStatus.label(status).toLowerCase()}',
              message: 'Bills, invoices and receipts found in your email appear here.',
            ),
          ),
        for (final card in cards) _BillTile(card: card, onMove: onMove),
        if (hasMore)
          Center(
            child: TextButton(
              onPressed: loadingMore ? null : onLoadMore,
              child: Text(loadingMore ? 'Loading…' : 'Load more'),
            ),
          ),
      ],
    ),
  );
}

class _BillTile extends StatelessWidget {
  const _BillTile({required this.card, required this.onMove});

  final PaymentCard card;
  final Future<void> Function(PaymentCard card, String status) onMove;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final amount = card.amountLabel;
    final overdue = card.kanbanStatus == PaymentStatus.overdue;
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => context.push(Routes.billPath(card.id)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 10, 4, 10),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: 4,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            card.merchant.isNotEmpty ? card.merchant : displayNameFromAddress(card.from),
                            style: theme.textTheme.titleSmall,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (amount != null) Text(amount, style: theme.textTheme.titleSmall),
                      ],
                    ),
                    Text(card.subject, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.textTheme.bodySmall),
                    Wrap(
                      spacing: 8,
                      children: [
                        Text(
                          paymentTypeLabels[card.paymentType] ?? card.paymentType,
                          style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.primary),
                        ),
                        if (card.dueDate != null)
                          Text(
                            'Due ${formatListDate(card.dueDate)}',
                            style: theme.textTheme.labelSmall?.copyWith(
                              color: overdue ? theme.colorScheme.error : theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                tooltip: 'Move to',
                onSelected: (s) => onMove(card, s),
                itemBuilder: (_) => [
                  for (final s in PaymentStatus.all)
                    if (s != card.kanbanStatus) PopupMenuItem(value: s, child: Text('Move to ${PaymentStatus.label(s)}')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
