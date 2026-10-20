import 'dart:convert';

import 'package:dio/dio.dart';

import '../core/errors/api_exception.dart';
import '../core/network/api_client.dart';
import '../models/ai_chat.dart';
import '../models/json.dart';

class AiConversation {
  const AiConversation({required this.id, required this.title, this.updatedAt});

  final String id;
  final String title;
  final DateTime? updatedAt;

  factory AiConversation.fromJson(JsonMap json) => AiConversation(
    id: readString(json, 'id'),
    title: readString(json, 'title', 'New chat'),
    updatedAt: readDate(json, 'updatedAt') ?? readDate(json, 'createdAt'),
  );
}

class AiReplyDraft {
  const AiReplyDraft({required this.tone, required this.body, this.subject = '', this.confidence = ''});

  final String tone;
  final String subject;
  final String body;
  final String confidence;
}

/// AI endpoints (packages/api/modules/ai).
class AiService {
  AiService(this._api);

  final ApiClient _api;

  // --- Reply drafts (AI draft panel) ---

  Future<({String intent, List<AiReplyDraft> drafts})> generateDrafts({
    required String mailboxId,
    required String body,
    String? subject,
    String? fromName,
    String? fromEmail,
    String? senderName,
  }) async {
    final data = asMap(
      await _api.post(
        '/ai/generate-drafts',
        body: {
          'mailboxId': mailboxId,
          'body': body,
          'subject': ?subject,
          'fromName': ?fromName,
          'fromEmail': ?fromEmail,
          'senderName': ?senderName,
        },
      ),
    );
    return (
      intent: readString(data, 'intent'),
      drafts: [
        for (final d in asMapList(data['drafts']))
          AiReplyDraft(tone: readString(d, 'tone'), body: readString(d, 'body'), confidence: readString(d, 'confidence')),
      ],
    );
  }

  // --- Voice compose ---

  /// [mediaType]: audio/webm, audio/mp4, audio/wav or audio/ogg.
  Future<String> transcribe(List<int> audio, {required String mediaType}) async => readString(
    asMap(await _api.post('/ai/transcribe-voice', body: {'audio': base64Encode(audio), 'mediaType': mediaType})),
    'text',
  );

  /// Turns a spoken ramble into polished email drafts in several tones.
  Future<List<AiReplyDraft>> composeFromTranscript(String transcript) async => [
    for (final d in asMapList(
      asMap(await _api.post('/ai/compose-voice-email', body: {'transcript': transcript}))['drafts'],
    ))
      AiReplyDraft(tone: readString(d, 'tone'), subject: readString(d, 'subject'), body: readString(d, 'body')),
  ];

  // --- Assistant conversations ---

  Future<List<AiConversation>> listConversations(String mailboxId) async => asMapList(
    asMap(await _api.get('/ai/conversations', query: {'mailboxId': mailboxId}))['conversations'],
  ).map(AiConversation.fromJson).toList();

  Future<AiConversation> createConversation(String mailboxId, {String? title}) async =>
      AiConversation.fromJson(
        asMap(
          asMap(await _api.post('/ai/conversations', body: {'mailboxId': mailboxId, 'title': ?title}))['conversation'],
        ),
      );

  Future<List<ChatMessage>> conversationMessages(String id) async => asMapList(
    asMap(await _api.get('/ai/conversations/${Uri.encodeComponent(id)}'))['messages'],
  ).map(ChatMessage.fromJson).toList();

  Future<void> renameConversation(String id, String title) =>
      _api.patch('/ai/conversations/${Uri.encodeComponent(id)}', body: {'title': title});

  Future<void> deleteConversation(String id) =>
      _api.delete('/ai/conversations/${Uri.encodeComponent(id)}');

  /// Streams the inbox assistant's reply as AI SDK UI-message chunks.
  Stream<JsonMap> inboxAssistant({
    required String mailboxId,
    required String conversationId,
    required List<ChatMessage> messages,
    String? timeZone,
    CancelToken? cancelToken,
  }) => _chunks(
    _api.postSse(
      '/ai/inbox-assistant',
      cancelToken: cancelToken,
      body: {
        'mailboxId': mailboxId,
        'conversationId': conversationId,
        'messages': messages.map((m) => m.toJson()).toList(),
        'timeZone': ?timeZone,
      },
    ),
  );

  /// Streams the rules assistant's reply (proposes rules via `proposeRule`).
  Stream<JsonMap> rulesAssistant({
    required String mailboxId,
    required List<ChatMessage> messages,
    CancelToken? cancelToken,
  }) => _chunks(
    _api.postSse(
      '/ai/rules-assistant',
      cancelToken: cancelToken,
      body: {'mailboxId': mailboxId, 'messages': messages.map((m) => m.toJson()).toList()},
    ),
  );

  static Stream<JsonMap> _chunks(Stream<SseEvent> events) async* {
    await for (final e in events) {
      if (e.event == 'done') return;
      if (e.data.isEmpty) continue;
      final Object? decoded;
      try {
        decoded = jsonDecode(e.data);
      } on FormatException {
        continue;
      }
      if (e.event == 'error') {
        final err = asMap(decoded);
        throw ApiException(
          code: readString(err, 'code', 'INTERNAL_SERVER_ERROR'),
          message: readString(err, 'message'),
          status: err['status'] is int ? err['status'] as int : null,
        );
      }
      yield asMap(decoded);
    }
  }
}
