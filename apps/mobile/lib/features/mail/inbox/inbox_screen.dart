import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/routes.dart';
import '../../../models/mailbox.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../mail_providers.dart';
import '../message_actions.dart';
import 'message_tile.dart';

const _folderTitles = {
  'inbox': 'Inbox',
  'all': 'All Emails',
  'sent': 'Sent',
  'trash': 'Trash',
};

class InboxScreen extends ConsumerStatefulWidget {
  const InboxScreen({super.key, this.folder = 'inbox', this.label});

  final String folder;
  final String? label;

  @override
  ConsumerState<InboxScreen> createState() => _InboxScreenState();
}

class _InboxScreenState extends ConsumerState<InboxScreen> {
  final _scroll = ScrollController();
  final _searchController = TextEditingController();
  bool _searching = false;
  String? _search;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(_onScroll);
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _scroll.dispose();
    _searchController.dispose();
    super.dispose();
  }

  InboxQuery? _query(Mailbox? mailbox) => mailbox == null
      ? null
      : InboxQuery(
          mailboxId: mailbox.id,
          folder: widget.folder,
          label: widget.label,
          search: _search,
        );

  void _onScroll() {
    final query = _query(ref.read(selectedMailboxProvider));
    if (query == null) return;
    if (_scroll.position.extentAfter < 600) {
      unawaited(ref.read(inboxProvider(query).notifier).loadMore());
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      final trimmed = value.trim();
      setState(() => _search = trimmed.isEmpty ? null : trimmed);
    });
  }

  Future<void> _refresh(InboxQuery query) async {
    final mail = ref.read(mailServiceProvider);
    // Ask the server to pull new mail, then reload the list.
    try {
      await mail.sync(query.mailboxId);
    } catch (_) {
      // Listing still works if a sync request fails.
    }
    await ref.read(inboxProvider(query).notifier).refresh();
    ref.invalidate(labelCountsProvider(query.mailboxId));
  }

  @override
  Widget build(BuildContext context) {
    final mailboxes = ref.watch(mailboxesProvider);
    final mailbox = ref.watch(selectedMailboxProvider);
    final query = _query(mailbox);

    // Real-time: refresh when the backend signals new mail.
    if (mailbox != null && query != null) {
      ref.listen(inboxEventsProvider(mailbox.id), (_, next) {
        if (next.hasValue) {
          unawaited(ref.read(inboxProvider(query).notifier).refresh());
          ref.invalidate(labelCountsProvider(mailbox.id));
        }
      });
    }

    final title = widget.label ?? _folderTitles[widget.folder] ?? 'Mail';
    final selectedKey = widget.label != null ? 'label:${widget.label}' : 'folder:${widget.folder}';

    return Scaffold(
      drawer: AppDrawer(selected: selectedKey),
      appBar: AppBar(
        title: _searching
            ? TextField(
                controller: _searchController,
                autofocus: true,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: 'Search $title',
                  border: InputBorder.none,
                ),
                onChanged: _onSearchChanged,
              )
            : Text(title),
        actions: [
          IconButton(
            tooltip: _searching ? 'Close search' : 'Search',
            icon: Icon(_searching ? Icons.close : Icons.search),
            onPressed: () => setState(() {
              _searching = !_searching;
              if (!_searching) {
                _searchController.clear();
                _search = null;
              }
            }),
          ),
        ],
      ),
      floatingActionButton: mailbox == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => context.push(Routes.compose),
              icon: const Icon(Icons.edit_outlined),
              label: const Text('Compose'),
            ),
      body: mailboxes.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => ErrorView(
          error: e,
          onRetry: () => ref.invalidate(mailboxesProvider),
        ),
        data: (_) => query == null
            ? const EmptyView(
                icon: Icons.mark_email_unread_outlined,
                title: 'No mailbox connected',
                message: 'Connect Gmail, Outlook or another email account to get started.',
              )
            : Column(
                children: [
                  _SyncBanner(mailboxId: query.mailboxId, onProgress: () => ref.read(inboxProvider(query).notifier).refresh()),
                  Expanded(child: _MessageList(query: query, scroll: _scroll, onRefresh: _refresh)),
                ],
              ),
      ),
    );
  }
}

class _MessageList extends ConsumerWidget {
  const _MessageList({required this.query, required this.scroll, required this.onRefresh});

  final InboxQuery query;
  final ScrollController scroll;
  final Future<void> Function(InboxQuery) onRefresh;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final inbox = ref.watch(inboxProvider(query));
    return inbox.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(inboxProvider(query))),
      data: (state) {
        if (state.messages.isEmpty) {
          return RefreshIndicator(
            onRefresh: () => onRefresh(query),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(
                  height: 400,
                  child: EmptyView(
                    icon: query.search != null ? Icons.search_off : Icons.inbox_outlined,
                    title: query.search != null ? 'No results' : 'Nothing here',
                    message: query.search != null
                        ? 'No emails match "${query.search}".'
                        : query.folder == 'inbox'
                        ? 'You\'re all caught up.'
                        : null,
                  ),
                ),
              ],
            ),
          );
        }
        final canArchive = query.folder != 'trash' && query.folder != 'sent';
        final inTrash = query.folder == 'trash';
        return RefreshIndicator(
          onRefresh: () => onRefresh(query),
          child: ListView.separated(
            controller: scroll,
            physics: const AlwaysScrollableScrollPhysics(),
            itemCount: state.messages.length + 1,
            separatorBuilder: (_, _) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, index) {
              if (index == state.messages.length) {
                return _ListFooter(state: state, onRetry: () => ref.read(inboxProvider(query).notifier).loadMore());
              }
              final message = state.messages[index];
              return Dismissible(
                key: ValueKey(message.id),
                direction: DismissDirection.horizontal,
                background: _SwipeBackground(
                  icon: canArchive ? Icons.archive_outlined : Icons.delete_outline,
                  label: canArchive ? 'Archive' : (inTrash ? 'Delete' : 'Trash'),
                  alignLeft: true,
                ),
                secondaryBackground: _SwipeBackground(
                  icon: inTrash ? Icons.delete_forever_outlined : Icons.delete_outline,
                  label: inTrash ? 'Delete' : 'Trash',
                  alignLeft: false,
                  destructive: true,
                ),
                confirmDismiss: (direction) async {
                  final action = inTrash
                      ? MessageAction.delete
                      : (direction == DismissDirection.startToEnd && canArchive)
                      ? MessageAction.archive
                      : MessageAction.trash;
                  await runMessageAction(
                    context,
                    ref,
                    action: action,
                    mailboxId: query.mailboxId,
                    messageId: message.id,
                    query: query,
                  );
                  // The list already removed the item optimistically.
                  return false;
                },
                child: MessageTile(
                  message: message,
                  onTap: () => context.push(
                    Routes.messagePath(message.id),
                    extra: query,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _ListFooter extends StatelessWidget {
  const _ListFooter({required this.state, required this.onRetry});

  final InboxState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (state.loadingMore) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (state.loadMoreError != null) {
      return Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: TextButton.icon(
            onPressed: onRetry,
            icon: const Icon(Icons.refresh),
            label: Text(errorMessage(state.loadMoreError!)),
          ),
        ),
      );
    }
    return const SizedBox(height: 96); // room above the FAB
  }
}

class _SwipeBackground extends StatelessWidget {
  const _SwipeBackground({
    required this.icon,
    required this.label,
    required this.alignLeft,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final bool alignLeft;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final color = destructive ? scheme.error : scheme.primary;
    return Container(
      color: color,
      padding: const EdgeInsets.symmetric(horizontal: 24),
      alignment: alignLeft ? Alignment.centerLeft : Alignment.centerRight,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

/// Initial mailbox sync progress, polled every 4 s like the web.
class _SyncBanner extends ConsumerStatefulWidget {
  const _SyncBanner({required this.mailboxId, required this.onProgress});

  final String mailboxId;

  /// Reloads the list as more history arrives (web InboxPage refetch).
  final Future<void> Function() onProgress;

  @override
  ConsumerState<_SyncBanner> createState() => _SyncBannerState();
}

class _SyncBannerState extends ConsumerState<_SyncBanner> {
  Timer? _timer;
  int? _synced;
  bool _complete = true;

  @override
  void initState() {
    super.initState();
    unawaited(_poll());
  }

  @override
  void didUpdateWidget(covariant _SyncBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.mailboxId != widget.mailboxId) unawaited(_poll());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  /// Mailboxes whose full-history sync this app run has already started
  /// (the web triggers it once per mailbox, too).
  static final Set<String> _triggered = {};

  Future<void> _poll() async {
    _timer?.cancel();
    final mail = ref.read(mailServiceProvider);
    final mailboxId = widget.mailboxId;
    try {
      final status = await mail.syncStatus(mailboxId);
      if (!mounted) return;
      if (!status.complete && _triggered.add(mailboxId)) {
        unawaited(
          mail.sync(mailboxId, mode: 'full').catchError((Object _) {
            _triggered.remove(mailboxId); // retry on the next poll
          }),
        );
      }
      final grew = _synced != null && status.syncedCount != _synced;
      setState(() {
        _complete = status.complete;
        _synced = status.syncedCount;
      });
      if (grew) unawaited(widget.onProgress().catchError((Object _) {}));
      if (status.complete) return;
    } catch (_) {
      // Informational only — keep polling through transient failures.
      if (!mounted) return;
    }
    _timer = Timer(const Duration(seconds: 4), _poll);
  }

  @override
  Widget build(BuildContext context) {
    if (_complete) return const SizedBox.shrink();
    return MaterialBanner(
      leading: const SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      content: Text(
        'Syncing your mailbox… ${_synced ?? 0} emails so far.',
      ),
      actions: const [SizedBox.shrink()],
    );
  }
}
