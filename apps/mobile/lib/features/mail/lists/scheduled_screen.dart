import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/mail_items.dart';
import '../../../shared/utils/format.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../mail_providers.dart';

final scheduledProvider = FutureProvider.family<List<ScheduledEmail>, String>(
  (ref, mailboxId) => ref.watch(mailServiceProvider).listScheduled(mailboxId),
);

class ScheduledScreen extends ConsumerWidget {
  const ScheduledScreen({super.key});

  Future<void> _cancel(BuildContext context, WidgetRef ref, String mailboxId, ScheduledEmail s) async {
    final ok = await confirmAction(
      context,
      title: 'Cancel scheduled email?',
      message: '"${s.subject}" won\'t be sent.',
      confirmLabel: 'Cancel send',
    );
    if (!ok) return;
    try {
      await ref.read(mailServiceProvider).cancelScheduled(mailboxId, s.id);
      ref.invalidate(scheduledProvider(mailboxId));
      if (context.mounted) showMessage(context, 'Scheduled send cancelled');
    } catch (e) {
      if (context.mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      drawer: const AppDrawer(selected: 'scheduled'),
      appBar: AppBar(title: const Text('Scheduled')),
      body: mailbox == null
          ? const Center(child: CircularProgressIndicator())
          : ref.watch(scheduledProvider(mailbox.id)).when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(scheduledProvider(mailbox.id))),
              data: (items) => RefreshIndicator(
                onRefresh: () => ref.refresh(scheduledProvider(mailbox.id).future),
                child: items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(
                            height: 360,
                            child: EmptyView(
                              icon: Icons.schedule_send_outlined,
                              title: 'Nothing scheduled',
                              message: 'Use "Schedule send" when composing to send later.',
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
                            leading: const Icon(Icons.schedule_send_outlined),
                            title: Text(s.subject.isNotEmpty ? s.subject : '(no subject)'),
                            subtitle: Text('To: ${s.to}\n${formatUpcoming(s.scheduledAt)}'),
                            isThreeLine: true,
                            trailing: IconButton(
                              tooltip: 'Cancel send',
                              icon: const Icon(Icons.cancel_schedule_send_outlined),
                              onPressed: () => _cancel(context, ref, mailbox.id, s),
                            ),
                          );
                        },
                      ),
              ),
            ),
    );
  }
}
