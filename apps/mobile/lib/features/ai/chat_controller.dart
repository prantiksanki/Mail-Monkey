import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../../models/ai_chat.dart';
import '../../models/json.dart';
import '../../shared/widgets/state_views.dart';

/// Sends the conversation so far and returns the assistant's chunk stream.
typedef ChatSender = Stream<JsonMap> Function(List<ChatMessage> messages, CancelToken cancel);

/// Streaming chat state shared by the inbox assistant and rules assistant —
/// the mobile counterpart of the web's `useChat`.
class ChatController extends ChangeNotifier {
  ChatController({required this.send, List<ChatMessage> initial = const []})
    : messages = [for (final m in initial) m.copy()];

  final ChatSender send;
  final List<ChatMessage> messages;
  bool streaming = false;
  String? error;
  CancelToken? _cancel;

  Future<void> sendText(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || streaming) return;
    messages.add(ChatMessage.user(trimmed));
    await _run();
  }

  /// Approve/deny a tool that needs confirmation, then resubmit once every
  /// pending approval in the turn is answered (like `sendAutomaticallyWhen`).
  Future<void> answerApproval(String approvalId, {required bool approved}) async {
    if (messages.isEmpty) return;
    // Same reason as the web ChatView: a denial needs it, or the denied tool
    // result reaches the model with empty content and the provider rejects it.
    respondToApproval(messages.last, approvalId, approved: approved, reason: approved ? null : 'User declined');
    notifyListeners();
    if (readyToResubmitAfterApprovals(messages)) await _run();
  }

  /// Supplies a client-side tool's result (e.g. rules assistant proposal
  /// accepted/rejected) and continues the turn.
  Future<void> provideToolOutput(String toolCallId, Object? output) async {
    if (messages.isEmpty) return;
    addToolOutput(messages.last, toolCallId, output);
    notifyListeners();
    await _run();
  }

  void stop() => _cancel?.cancel('stopped');

  Future<void> _run() async {
    error = null;
    streaming = true;
    // Continue the last assistant message when resubmitting after approvals
    // or tool output; otherwise start a new one.
    final continuing = messages.isNotEmpty && !messages.last.isUser;
    final assistant = continuing ? messages.last : ChatMessage(id: 'pending', role: 'assistant');
    if (!continuing) messages.add(assistant);
    final applier = ChatStreamApplier(assistant);
    final payload = [for (final m in messages) if (m != assistant || continuing) m];
    _cancel = CancelToken();
    notifyListeners();
    try {
      await for (final chunk in send(payload, _cancel!)) {
        applier.apply(chunk);
        notifyListeners();
      }
      if (applier.error != null) error = applier.error;
    } on DioException catch (e) {
      if (!CancelToken.isCancel(e)) error = 'Connection lost. Please try again.';
    } catch (e) {
      error = errorMessage(e);
    } finally {
      if (!continuing && assistant.parts.isEmpty) messages.remove(assistant);
      streaming = false;
      _cancel = null;
      notifyListeners();
    }
  }
}
