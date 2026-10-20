import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/ai_chat.dart';
import '../../shared/widgets/state_views.dart';
import '../mail/mail_providers.dart';
import 'ai_providers.dart';
import 'chat_controller.dart';
import 'chat_view.dart';

const _suggestions = [
  'Summarize what came in today.',
  "Any clients I haven't replied to?",
  'What did LinkedIn send me this week?',
  'What rules do I have active right now?',
];

/// Loads a conversation's history (unless it was just created).
final _historyProvider = FutureProvider.autoDispose.family<List<ChatMessage>, String>(
  (ref, id) => ref.watch(aiServiceProvider).conversationMessages(id),
);

/// One inbox assistant conversation (web ChatView): streaming answers,
/// cited emails and approval cards for risky actions.
class AssistantChatScreen extends ConsumerWidget {
  const AssistantChatScreen({super.key, required this.conversationId, this.isNew = false, this.initialText});

  final String conversationId;
  final bool isNew;

  /// Prefilled prompt (e.g. a voice transcript), sent immediately.
  final String? initialText;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final mailbox = ref.watch(selectedMailboxProvider);
    final history = isNew ? const AsyncData(<ChatMessage>[]) : ref.watch(_historyProvider(conversationId));
    return Scaffold(
      appBar: AppBar(title: const Text('AI assistant')),
      body: mailbox == null
          ? const EmptyView(icon: Icons.auto_awesome, title: 'Connect a mailbox to use the assistant')
          : history.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => ErrorView(error: e, onRetry: () => ref.invalidate(_historyProvider(conversationId))),
              data: (messages) => _AssistantChat(
                key: ValueKey(conversationId),
                mailboxId: mailbox.id,
                conversationId: conversationId,
                initial: messages,
                initialText: initialText,
              ),
            ),
    );
  }
}

class _AssistantChat extends ConsumerStatefulWidget {
  const _AssistantChat({
    super.key,
    required this.mailboxId,
    required this.conversationId,
    required this.initial,
    this.initialText,
  });

  final String mailboxId;
  final String conversationId;
  final List<ChatMessage> initial;
  final String? initialText;

  @override
  ConsumerState<_AssistantChat> createState() => _AssistantChatState();
}

class _AssistantChatState extends ConsumerState<_AssistantChat> {
  late final ChatController _chat;
  late bool _titled = widget.initial.any((m) => m.isUser);

  @override
  void initState() {
    super.initState();
    final ai = ref.read(aiServiceProvider);
    _chat = ChatController(
      initial: widget.initial,
      send: (messages, cancel) async* {
        final timeZone = await ref.read(deviceTimeZoneProvider.future);
        yield* ai.inboxAssistant(
          mailboxId: widget.mailboxId,
          conversationId: widget.conversationId,
          messages: messages,
          timeZone: timeZone,
          cancelToken: cancel,
        );
      },
    )..addListener(_maybeTitle);
    final text = widget.initialText;
    if (text != null && text.trim().isNotEmpty) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _chat.sendText(text));
    }
  }

  /// Auto-title the thread from the first thing the user asked, like the web.
  void _maybeTitle() {
    if (_titled) return;
    final first = _chat.messages.where((m) => m.isUser).firstOrNull;
    if (first == null) return;
    _titled = true;
    final text = first.text;
    ref
        .read(aiServiceProvider)
        .renameConversation(widget.conversationId, text.length > 60 ? text.substring(0, 60) : text)
        .then(
          (_) {
            if (mounted) ref.invalidate(conversationsProvider(widget.mailboxId));
          },
          onError: (Object _) {},
        );
  }

  @override
  void dispose() {
    _chat
      ..stop()
      ..dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ChatView(
    controller: _chat,
    emptyTitle: 'Ask about your inbox',
    emptyHint: 'Search, summarise, draft, schedule and more. Risky actions always ask for your approval first.',
    suggestions: _suggestions,
  );
}
