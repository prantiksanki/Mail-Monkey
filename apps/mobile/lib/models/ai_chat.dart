import 'dart:math';

import 'json.dart';

/// A chat message in the Vercel AI SDK v6 `UIMessage` shape, which the
/// backend's assistants consume and persist. Parts are kept as raw JSON so
/// they round-trip to the server unchanged (text, reasoning, step markers,
/// tool calls with approval state, sources, data parts…).
class ChatMessage {
  ChatMessage({required this.id, required this.role, List<JsonMap>? parts})
    : parts = parts ?? [];

  factory ChatMessage.user(String text) => ChatMessage(
    id: _randomId(),
    role: 'user',
    parts: [
      {'type': 'text', 'text': text},
    ],
  );

  factory ChatMessage.fromJson(JsonMap json) => ChatMessage(
    id: readString(json, 'id', _randomId()),
    role: readString(json, 'role', 'assistant'),
    parts: asMapList(json['parts']).map((p) => Map<String, dynamic>.of(p)).toList(),
  );

  String id;
  final String role;
  final List<JsonMap> parts;

  bool get isUser => role == 'user';

  /// All text parts joined (what the user reads).
  String get text => parts
      .where((p) => p['type'] == 'text')
      .map((p) => p['text']?.toString() ?? '')
      .join();

  /// Tool-call parts (`type: tool-<name>`).
  Iterable<ToolPart> get tools => parts
      .where((p) => (p['type'] as String? ?? '').startsWith('tool-'))
      .map(ToolPart.new);

  JsonMap toJson() => {'id': id, 'role': role, 'parts': parts};

  ChatMessage copy() => ChatMessage(
    id: id,
    role: role,
    parts: [for (final p in parts) Map<String, dynamic>.of(p)],
  );
}

/// View over a tool part map.
class ToolPart {
  ToolPart(this.raw);

  final JsonMap raw;

  String get name => (raw['type'] as String).substring('tool-'.length);
  String get toolCallId => raw['toolCallId']?.toString() ?? '';

  /// input-streaming, input-available, approval-requested,
  /// approval-responded, output-available, output-error, output-denied.
  String get state => raw['state']?.toString() ?? 'input-streaming';
  JsonMap get input => asMap(raw['input']);
  Object? get output => raw['output'];
  String? get errorText => raw['errorText']?.toString();
  String? get approvalId => asMap(raw['approval'])['id']?.toString();

  bool get awaitingApproval => state == 'approval-requested';
  bool get isDone => const {'output-available', 'output-error', 'output-denied'}.contains(state);
}

/// Applies AI SDK UI-message stream chunks to the assistant message being
/// generated — the same transitions as the SDK's `processUIMessageStream`.
class ChatStreamApplier {
  ChatStreamApplier(this.message);

  final ChatMessage message;
  final Map<String, JsonMap> _textById = {};
  final Map<String, JsonMap> _reasoningById = {};
  String? error;
  bool finished = false;

  JsonMap _tool(String toolCallId, {String? toolName}) {
    for (final p in message.parts) {
      if (p['toolCallId'] == toolCallId) return p;
    }
    final part = <String, dynamic>{
      'type': 'tool-${toolName ?? 'unknown'}',
      'toolCallId': toolCallId,
      'state': 'input-streaming',
    };
    message.parts.add(part);
    return part;
  }

  void apply(JsonMap chunk) {
    final type = chunk['type']?.toString() ?? '';
    switch (type) {
      case 'start':
        final id = chunk['messageId'];
        if (id is String && id.isNotEmpty) message.id = id;
      case 'start-step':
        message.parts.add({'type': 'step-start'});
      case 'text-start':
        final part = <String, dynamic>{'type': 'text', 'text': '', 'state': 'streaming'};
        _textById[chunk['id'].toString()] = part;
        message.parts.add(part);
      case 'text-delta':
        final part = _textById[chunk['id'].toString()] ??
            (message.parts..add({'type': 'text', 'text': '', 'state': 'streaming'})).last;
        part['text'] = '${part['text'] ?? ''}${chunk['delta'] ?? ''}';
      case 'text-end':
        _textById.remove(chunk['id'].toString())?['state'] = 'done';
      case 'reasoning-start':
        final part = <String, dynamic>{'type': 'reasoning', 'text': '', 'state': 'streaming'};
        _reasoningById[chunk['id'].toString()] = part;
        message.parts.add(part);
      case 'reasoning-delta':
        final part = _reasoningById[chunk['id'].toString()];
        if (part != null) part['text'] = '${part['text'] ?? ''}${chunk['delta'] ?? ''}';
      case 'reasoning-end':
        _reasoningById.remove(chunk['id'].toString())?['state'] = 'done';
      case 'tool-input-start':
        _tool(chunk['toolCallId'].toString(), toolName: chunk['toolName']?.toString());
      case 'tool-input-available':
        _tool(chunk['toolCallId'].toString(), toolName: chunk['toolName']?.toString())
          ..['state'] = 'input-available'
          ..['input'] = chunk['input'];
      case 'tool-input-error':
        _tool(chunk['toolCallId'].toString(), toolName: chunk['toolName']?.toString())
          ..['state'] = 'output-error'
          ..['input'] = chunk['input']
          ..['errorText'] = chunk['errorText'];
      case 'tool-approval-request':
        _tool(chunk['toolCallId'].toString())
          ..['state'] = 'approval-requested'
          ..['approval'] = {'id': chunk['approvalId']};
      case 'tool-output-available':
        _tool(chunk['toolCallId'].toString())
          ..['state'] = 'output-available'
          ..['output'] = chunk['output'];
      case 'tool-output-error':
        _tool(chunk['toolCallId'].toString())
          ..['state'] = 'output-error'
          ..['errorText'] = chunk['errorText'];
      case 'tool-output-denied':
        _tool(chunk['toolCallId'].toString())['state'] = 'output-denied';
      case 'source-url' || 'source-document' || 'file':
        message.parts.add(Map<String, dynamic>.of(chunk));
      case 'error':
        error = chunk['errorText']?.toString() ?? 'Something went wrong';
      case 'finish' || 'abort':
        finished = true;
      default:
        // Persistent data parts (`data-*`); transient ones are display-only.
        if (type.startsWith('data-') && chunk['transient'] != true) {
          message.parts.add(Map<String, dynamic>.of(chunk));
        }
    }
  }
}

/// Records the user's decision on a tool that needs approval
/// (`approval-requested` → `approval-responded`), like the SDK's
/// `addToolApprovalResponse`.
void respondToApproval(ChatMessage message, String approvalId, {required bool approved, String? reason}) {
  for (final p in message.parts) {
    final approval = asMap(p['approval']);
    if (p['state'] == 'approval-requested' && approval['id'] == approvalId) {
      p['state'] = 'approval-responded';
      p['approval'] = {'id': approvalId, 'approved': approved, 'reason': ?reason};
    }
  }
}

/// Supplies the result of a client-side tool (e.g. the rules assistant's
/// `proposeRule`), like the SDK's `addToolOutput`.
void addToolOutput(ChatMessage message, String toolCallId, Object? output) {
  for (final p in message.parts) {
    if (p['toolCallId'] == toolCallId) {
      p['state'] = 'output-available';
      p['output'] = output;
    }
  }
}

/// True when every approval in the last assistant message has been answered
/// and at least one exists — time to resubmit (SDK
/// `lastAssistantMessageIsCompleteWithApprovalResponses`).
bool readyToResubmitAfterApprovals(List<ChatMessage> messages) {
  if (messages.isEmpty || messages.last.isUser) return false;
  final tools = messages.last.tools.toList();
  final responded = tools.where((t) => t.state == 'approval-responded');
  return responded.isNotEmpty && !tools.any((t) => t.awaitingApproval);
}

String _randomId() {
  final rng = Random.secure();
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return List.generate(16, (_) => chars[rng.nextInt(chars.length)]).join();
}
