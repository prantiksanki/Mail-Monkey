import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/errors/api_exception.dart';
import '../../core/providers.dart';
import '../../models/label.dart';
import '../../models/mailbox.dart';
import '../../models/message.dart';
import '../../models/rule.dart';
import '../../services/mail_service.dart';
import '../../services/rules_service.dart';

final mailServiceProvider = Provider<MailService>(
  (ref) => MailService(ref.watch(apiClientProvider)),
);

final rulesServiceProvider = Provider<RulesService>(
  (ref) => RulesService(ref.watch(apiClientProvider)),
);

/// Mailboxes connected to the signed-in user.
final mailboxesProvider = FutureProvider<List<Mailbox>>(
  (ref) => ref.watch(mailServiceProvider).connectedMailboxes(),
);

/// The mailbox the user is working in (defaults to the first one).
final selectedMailboxIdProvider =
    NotifierProvider<SelectedMailboxId, String?>(SelectedMailboxId.new);

class SelectedMailboxId extends Notifier<String?> {
  @override
  String? build() => null;

  void select(String id) => state = id;
}

final selectedMailboxProvider = Provider<Mailbox?>((ref) {
  final mailboxes = ref.watch(mailboxesProvider).value ?? const <Mailbox>[];
  if (mailboxes.isEmpty) return null;
  final id = ref.watch(selectedMailboxIdProvider);
  return mailboxes.firstWhere((m) => m.id == id, orElse: () => mailboxes.first);
});

final labelCountsProvider = FutureProvider.family<LabelCounts, String>(
  (ref, mailboxId) => ref.watch(mailServiceProvider).labelCounts(mailboxId),
);

final rulesProvider = FutureProvider.family<List<Rule>, String>(
  (ref, mailboxId) => ref.watch(rulesServiceProvider).list(mailboxId),
);

/// Sidebar labels: rules with a LABEL action plus an IMAP account's own
/// folders, de-duplicated case-insensitively (same as the web NavBar).
final labelsProvider = Provider.family<List<MailLabel>, String>((ref, mailboxId) {
  final rules = ref.watch(rulesProvider(mailboxId)).value ?? const <Rule>[];
  final counts = ref.watch(labelCountsProvider(mailboxId)).value ?? LabelCounts.empty;
  final seen = <String>{};
  final labels = <MailLabel>[];
  for (final rule in rules) {
    final name = rule.labelName;
    if (name == null) continue;
    if (seen.add(name.trim().toLowerCase())) {
      labels.add(MailLabel(id: rule.id, name: name));
    }
  }
  for (final name in counts.folderLabels) {
    if (seen.add(name.trim().toLowerCase())) {
      labels.add(MailLabel(id: 'folder:$name', name: name));
    }
  }
  return labels;
});

/// Which list the inbox screen shows.
@immutable
class InboxQuery {
  const InboxQuery({
    required this.mailboxId,
    this.folder = 'inbox',
    this.label,
    this.search,
  });

  final String mailboxId;
  final String folder;
  final String? label;
  final String? search;

  @override
  bool operator ==(Object other) =>
      other is InboxQuery &&
      other.mailboxId == mailboxId &&
      other.folder == folder &&
      other.label == label &&
      other.search == search;

  @override
  int get hashCode => Object.hash(mailboxId, folder, label, search);
}

@immutable
class InboxState {
  const InboxState({
    required this.messages,
    this.nextPageToken,
    this.loadingMore = false,
    this.loadMoreError,
  });

  final List<MessageSummary> messages;
  final String? nextPageToken;
  final bool loadingMore;
  final Object? loadMoreError;

  bool get hasMore => nextPageToken != null;

  InboxState copyWith({
    List<MessageSummary>? messages,
    String? nextPageToken,
    bool clearToken = false,
    bool? loadingMore,
    Object? loadMoreError,
  }) => InboxState(
    messages: messages ?? this.messages,
    nextPageToken: clearToken ? null : (nextPageToken ?? this.nextPageToken),
    loadingMore: loadingMore ?? this.loadingMore,
    loadMoreError: loadMoreError,
  );
}

/// Paged message list (`pageToken` cursor, 50 per page like the web).
final inboxProvider =
    AsyncNotifierProvider.family<InboxController, InboxState, InboxQuery>(
      InboxController.new,
    );

class InboxController extends AsyncNotifier<InboxState> {
  InboxController(this.query);

  final InboxQuery query;

  MailService get _mail => ref.read(mailServiceProvider);

  @override
  Future<InboxState> build() async {
    final page = await _mail.listMessages(
      query.mailboxId,
      folder: query.folder,
      label: query.label,
      search: query.search,
    );
    return InboxState(messages: page.messages, nextPageToken: page.nextPageToken);
  }

  Future<void> refresh() async {
    try {
      final fresh = await build();
      state = AsyncData(fresh);
    } catch (e, st) {
      // Keep showing the current list if a background refresh fails.
      if (state.value == null) state = AsyncError(e, st);
    }
  }

  Future<void> loadMore() async {
    final current = state.value;
    if (current == null || !current.hasMore || current.loadingMore) return;
    state = AsyncData(current.copyWith(loadingMore: true));
    try {
      final page = await _mail.listMessages(
        query.mailboxId,
        folder: query.folder,
        label: query.label,
        search: query.search,
        pageToken: current.nextPageToken,
      );
      final known = current.messages.map((m) => m.id).toSet();
      state = AsyncData(
        current.copyWith(
          messages: [
            ...current.messages,
            ...page.messages.where((m) => !known.contains(m.id)),
          ],
          nextPageToken: page.nextPageToken,
          clearToken: page.nextPageToken == null,
          loadingMore: false,
        ),
      );
    } catch (e) {
      state = AsyncData(current.copyWith(loadingMore: false, loadMoreError: e));
    }
  }

  /// Optimistically hides a message (archive/trash/delete/snooze). Returns
  /// an undo callback that restores it at the same position.
  VoidCallback removeLocally(String messageId) {
    final current = state.value;
    if (current == null) return () {};
    final index = current.messages.indexWhere((m) => m.id == messageId);
    if (index < 0) return () {};
    final removed = current.messages[index];
    state = AsyncData(
      current.copyWith(
        messages: [...current.messages]..removeAt(index),
      ),
    );
    return () {
      final now = state.value;
      if (now == null || now.messages.any((m) => m.id == messageId)) return;
      final list = [...now.messages]..insert(min(index, now.messages.length), removed);
      state = AsyncData(now.copyWith(messages: list));
    };
  }

  void setUnreadLocally(String messageId, {required bool unread}) {
    final current = state.value;
    if (current == null) return;
    state = AsyncData(
      current.copyWith(
        messages: [
          for (final m in current.messages)
            m.id == messageId ? m.copyWith(isUnread: unread) : m,
        ],
      ),
    );
  }
}

/// New-mail signals from the backend's SSE stream, reconnecting with
/// back-off. Each event is a tick the inbox reacts to by refreshing.
final inboxEventsProvider = StreamProvider.family<int, String>((ref, mailboxId) {
  final controller = StreamController<int>();
  var cancelled = false;
  StreamSubscription<String>? subscription;
  var ticks = 0;

  Future<void> connect([int attempt = 0]) async {
    if (cancelled) return;
    try {
      subscription = ref
          .read(mailServiceProvider)
          .inboxEvents(mailboxId)
          .listen(
            (_) => controller.add(++ticks),
            onError: (Object _) => _retry(connect, attempt, () => cancelled),
            onDone: () => _retry(connect, 0, () => cancelled),
            cancelOnError: true,
          );
    } on ApiException catch (e) {
      if (!e.isUnauthorized) _retry(connect, attempt, () => cancelled);
    }
  }

  unawaited(connect());
  ref.onDispose(() {
    cancelled = true;
    unawaited(subscription?.cancel());
    unawaited(controller.close());
  });
  return controller.stream;
});

void _retry(
  Future<void> Function([int attempt]) connect,
  int attempt,
  bool Function() isCancelled,
) {
  if (isCancelled()) return;
  final delay = Duration(seconds: min(60, 2 << min(attempt, 5)));
  Timer(delay, () => connect(attempt + 1));
}
