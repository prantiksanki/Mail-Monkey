import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers.dart';
import '../../models/payment_card.dart';
import '../../services/bills_service.dart';

final billsServiceProvider = Provider<BillsService>((ref) => BillsService(ref.watch(apiClientProvider)));

class BillFilters {
  const BillFilters({this.mailboxId, this.paymentType, this.search});

  final String? mailboxId;
  final String? paymentType;
  final String? search;

  @override
  bool operator ==(Object other) =>
      other is BillFilters &&
      other.mailboxId == mailboxId &&
      other.paymentType == paymentType &&
      other.search == search;

  @override
  int get hashCode => Object.hash(mailboxId, paymentType, search);
}

class BillsState {
  const BillsState({required this.cards, this.nextCursor, this.loadingMore = false});

  final List<PaymentCard> cards;
  final String? nextCursor;
  final bool loadingMore;

  Map<String, List<PaymentCard>> get byStatus => {
    for (final s in PaymentStatus.all) s: cards.where((c) => c.kanbanStatus == s).toList(),
  };

  BillsState copyWith({List<PaymentCard>? cards, String? nextCursor, bool clearCursor = false, bool? loadingMore}) =>
      BillsState(
        cards: cards ?? this.cards,
        nextCursor: clearCursor ? null : (nextCursor ?? this.nextCursor),
        loadingMore: loadingMore ?? this.loadingMore,
      );
}

final billsProvider = AsyncNotifierProvider.autoDispose.family<BillsController, BillsState, BillFilters>(
  BillsController.new,
);

class BillsController extends AsyncNotifier<BillsState> {
  BillsController(this._filters);

  final BillFilters _filters;

  BillsService get _service => ref.read(billsServiceProvider);

  @override
  Future<BillsState> build() async {
    final page = await _service.list(
      mailboxId: _filters.mailboxId,
      paymentType: _filters.paymentType,
      search: _filters.search,
    );
    return BillsState(cards: page.cards, nextCursor: page.nextCursor);
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || current.nextCursor == null || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await _service.list(
        mailboxId: _filters.mailboxId,
        paymentType: _filters.paymentType,
        search: _filters.search,
        cursor: current.nextCursor,
      );
      state = AsyncData(
        BillsState(cards: [...current.cards, ...page.cards], nextCursor: page.nextCursor),
      );
    } on Exception {
      state = AsyncData(current.copyWith(loadingMore: false));
      rethrow;
    }
  }

  /// Optimistic move between columns, rolled back if the server rejects it
  /// (web useUpdatePaymentCardStatusMutation).
  Future<void> moveTo(String id, String status) async {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      current.copyWith(cards: [for (final c in current.cards) c.id == id ? c.withStatus(status) : c]),
    );
    try {
      await _service.updateStatus(id, status);
    } on Exception {
      state = AsyncData(current);
      rethrow;
    }
  }
}
