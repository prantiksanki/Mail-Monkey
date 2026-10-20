import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/routing/routes.dart';
import '../../../models/mail_items.dart';
import '../../../shared/utils/format.dart';
import '../../../shared/widgets/app_drawer.dart';
import '../../../shared/widgets/state_views.dart';
import '../compose/compose_screen.dart';
import '../mail_providers.dart';

final draftsProvider = FutureProvider.family<List<DraftSummary>, String>(
  (ref, mailboxId) => ref.watch(mailServiceProvider).listDrafts(mailboxId),
);

class DraftsScreen extends ConsumerWidget {
  const DraftsScreen({super.key});

  Future<void> _open(BuildContext context, WidgetRef ref, String mailboxId, DraftSummary d) async {
    try {
      final draft = await ref.read(mailServiceProvider).getDraft(mailboxId, d.draftId);
      if (!context.mounted) return;
      await context.push(
        Routes.compose,
        extra: ComposeArgs(
          to: draft.to,
          cc: draft.cc,
          bcc: draft.bcc,
          subject: draft.subject,
          body: draft.body,
          draftId: draft.draftId,
        ),
      );
      ref.invalidate(draftsProvider(mailboxId));
    } catch (e) {
      if (context.mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, String mailboxId, DraftSummary d) async {
    final ok = await confirmAction(context, title: 'Delete draft?', message: 'This draft will be discarded.');
    if (!ok) return;
    try {
      await ref.read(mailServiceProvider).deleteDraft(mailboxId, d.draftId);
      ref.invalidate(draftsProvider(mailboxId));
      if (context.mounted) showMessage(context, 'Draft deleted');
    } catch (e) {
      if (context.mounted) showMessage(context, errorMessage(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      drawer: const AppDrawer(selected: 'drafts'),
      appBar: AppBar(title: const Text('Drafts')),
      body: mailbox == null
          ? const Center(child: CircularProgressIndicator())
          : ref.watch(draftsProvider(mailbox.id)).when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(draftsProvider(mailbox.id))),
              data: (drafts) => RefreshIndicator(
                onRefresh: () => ref.refresh(draftsProvider(mailbox.id).future),
                child: drafts.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 360, child: EmptyView(icon: Icons.drafts_outlined, title: 'No drafts')),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        itemCount: drafts.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final d = drafts[i];
                          return ListTile(
                            leading: const Icon(Icons.drafts_outlined),
                            title: Text(d.subject.isNotEmpty ? d.subject : '(no subject)', maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: Text(
                              [if (d.to.isNotEmpty) 'To: ${d.to}', if (d.snippet.isNotEmpty) d.snippet].join(' · '),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(formatListDate(d.date), style: Theme.of(context).textTheme.labelSmall),
                                IconButton(
                                  tooltip: 'Delete draft',
                                  icon: const Icon(Icons.delete_outline),
                                  onPressed: () => _delete(context, ref, mailbox.id, d),
                                ),
                              ],
                            ),
                            onTap: () => _open(context, ref, mailbox.id, d),
                          );
                        },
                      ),
              ),
            ),
    );
  }
}
