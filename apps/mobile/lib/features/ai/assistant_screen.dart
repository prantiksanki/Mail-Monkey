import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/routing/routes.dart';
import '../../services/ai_service.dart';
import '../../shared/utils/format.dart';
import '../../shared/widgets/app_drawer.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'ai_providers.dart';

/// Inbox assistant conversations (web AiAssistantWidget → ConversationList).
class AssistantScreen extends ConsumerWidget {
  const AssistantScreen({super.key});

  Future<void> _newChat(BuildContext context, WidgetRef ref, String mailboxId) async {
    try {
      final convo = await ref.read(aiServiceProvider).createConversation(mailboxId);
      ref.invalidate(conversationsProvider(mailboxId));
      if (context.mounted) await context.push(Routes.aiChatPath(convo.id, isNew: true));
      ref.invalidate(conversationsProvider(mailboxId));
    } on Exception catch (e) {
      if (context.mounted) showMessage(context, "Couldn't start a new chat: ${errorMessage(e)}");
    }
  }

  Future<void> _rename(BuildContext context, WidgetRef ref, String mailboxId, AiConversation c) async {
    final controller = TextEditingController(text: c.title);
    final next = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Rename conversation'),
        content: TextField(controller: controller, autofocus: true, maxLength: 120),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
        ],
      ),
    );
    controller.dispose();
    if (next == null || next.trim().isEmpty || next.trim() == c.title) return;
    try {
      await ref.read(aiServiceProvider).renameConversation(c.id, next.trim());
      ref.invalidate(conversationsProvider(mailboxId));
    } on Exception {
      if (context.mounted) showMessage(context, "Couldn't rename conversation");
    }
  }

  Future<void> _delete(BuildContext context, WidgetRef ref, String mailboxId, AiConversation c) async {
    final ok = await confirmAction(
      context,
      title: 'Delete conversation?',
      message: 'This permanently deletes "${c.title}".',
      confirmLabel: 'Delete',
      destructive: true,
    );
    if (!ok) return;
    try {
      await ref.read(aiServiceProvider).deleteConversation(c.id);
      ref.invalidate(conversationsProvider(mailboxId));
    } on Exception {
      if (context.mounted) showMessage(context, "Couldn't delete conversation");
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    return Scaffold(
      drawer: const AppDrawer(selected: 'ai'),
      appBar: AppBar(
        title: const Text('AI assistant'),
        actions: [
          IconButton(
            tooltip: 'Voice compose',
            icon: const Icon(Icons.mic_none),
            onPressed: () => context.push(Routes.voiceCompose),
          ),
        ],
      ),
      floatingActionButton: mailbox == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => _newChat(context, ref, mailbox.id),
              icon: const Icon(Icons.add_comment_outlined),
              label: const Text('New chat'),
            ),
      body: mailbox == null
          ? const EmptyView(icon: Icons.auto_awesome, title: 'Connect a mailbox to use the assistant')
          : RefreshIndicator(
              onRefresh: () => ref.refresh(conversationsProvider(mailbox.id).future),
              child: ref.watch(conversationsProvider(mailbox.id)).when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(conversationsProvider(mailbox.id))),
                data: (items) => items.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        children: const [
                          SizedBox(height: 80),
                          EmptyView(
                            icon: Icons.forum_outlined,
                            title: 'No conversations yet',
                            message: 'Start a new chat to ask about your inbox.',
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.only(bottom: 88),
                        itemCount: items.length,
                        separatorBuilder: (_, _) => const Divider(height: 1),
                        itemBuilder: (context, i) {
                          final c = items[i];
                          return ListTile(
                            leading: const Icon(Icons.chat_bubble_outline),
                            title: Text(c.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                            subtitle: c.updatedAt == null ? null : Text(formatListDate(c.updatedAt)),
                            onTap: () async {
                              await context.push(Routes.aiChatPath(c.id));
                              ref.invalidate(conversationsProvider(mailbox.id));
                            },
                            trailing: PopupMenuButton<String>(
                              onSelected: (v) => v == 'rename'
                                  ? _rename(context, ref, mailbox.id, c)
                                  : _delete(context, ref, mailbox.id, c),
                              itemBuilder: (_) => const [
                                PopupMenuItem(value: 'rename', child: Text('Rename')),
                                PopupMenuItem(value: 'delete', child: Text('Delete')),
                              ],
                            ),
                          );
                        },
                      ),
              ),
            ),
    );
  }
}
