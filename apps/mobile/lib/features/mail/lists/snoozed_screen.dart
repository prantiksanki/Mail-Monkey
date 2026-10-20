import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/routes.dart';
import '../../../models/mail_items.dart';
import '../../../shared/utils/format.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../mail_providers.dart';

final snoozedProvider = FutureProvider.family<List<SnoozedEmail>, String>(
  (ref, mailboxId) => ref.watch(mailServiceProvider).listSnoozed(mailboxId),
);

class SnoozedScreen extends ConsumerWidget {
  const SnoozedScreen({super.key});

  Future<void> _unsnooze(BuildContext context, WidgetRef ref, String mailboxId, SnoozedEmail s) async {
    try {
      await ref.read(mailServiceProvider).cancelSnooze(mailboxId, s.id);
      ref
        ..invalidate(snoozedProvider(mailboxId))
        ..invalidate(labelCountsProvider(mailboxId));
      if (context.mounted) showMessage(context, 'Moved back to Inbox');
    } catch (e) {
      if (context.mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      drawer: const AppDrawer(selected: 'snoozed'),
      appBar: AppBar(title: const Text('Snoozed')),
      body: mailbox == null
          ? const Center(child: CircularProgressIndicator())
          : ref.watch(snoozedProvider(mailbox.id)).when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(snoozedProvider(mailbox.id))),
              data: (items) => RefreshIndicator(
                onRefresh: () => ref.refresh(snoozedProvider(mailbox.id).future),
                child: items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(
                            height: 360,
                            child: EmptyView(
                              icon: Icons.snooze_outlined,
                              title: 'No snoozed emails',
                              message: 'Snooze an email to have it come back later.',
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final s = items[i];
                          return ListTile(
                            leading: const Icon(Icons.snooze_outlined),
                            title: Text(s.subject.isNotEmpty ? s.subject : '(no subject)', maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text(
                              '${displayNameFromAddress(s.from)} · back ${formatUpcoming(s.snoozeUntil)}',
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: IconButton(
                              tooltip: 'Unsnooze',
                              icon: const Icon(Icons.alarm_off_outlined),
                              onPressed: () => _unsnooze(context, ref, mailbox.id, s),
                            ),
                            onTap: () => context.push(Routes.messagePath(s.messageId)),
                          );
                        },
                      ),
              ),
            ),
    );
  }
}
