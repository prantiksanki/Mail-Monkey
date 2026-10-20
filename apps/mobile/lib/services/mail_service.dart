import '../core/network/api_client.dart';
import '../models/json.dart';
import '../models/mail_items.dart';
import '../models/mailbox.dart';
import '../models/message.dart';

/// Mailbox, inbox and sending endpoints (packages/api/modules/mailboxes and
/// users). Paths and payloads follow the backend's OpenAPI routes.
class MailService {
  MailService(this._api);

  final ApiClient _api;

  String _mb(String mailboxId) => '/mailboxes/${Uri.encodeComponent(mailboxId)}';
  String _msg(String mailboxId, String messageId) =>
      '${_mb(mailboxId)}/inbox/${Uri.encodeComponent(messageId)}';

  // --- Mailboxes ---

  Future<List<Mailbox>> connectedMailboxes() async {
    final data = await _api.get('/users/connected-mailboxes');
    return asMapList(data).map(Mailbox.fromJson).toList();
  }

  Future<void> disconnect(String mailboxId) =>
      _api.post('${_mb(mailboxId)}/disconnect');

  // --- Inbox ---

  /// [folder]: inbox, all, sent, trash (drafts/scheduled/snoozed have their
  /// own endpoints). [label] filters by label name; [search] is free text.
  Future<MessagePage> listMessages(
    String mailboxId, {
    String folder = 'inbox',
    String? label,
    String? search,
    String? pageToken,
    int maxResults = 50,
  }) async {
    final data = await _api.get(
      '${_mb(mailboxId)}/inbox',
      query: {
        'folder': folder,
        'label': label,
        'search': search?.trim(),
        'pageToken': pageToken,
        'maxResults': maxResults,
      },
    );
    return MessagePage.fromJson(asMap(data));
  }

  Future<MessageDetail> getMessage(String mailboxId, String messageId) async =>
      MessageDetail.fromJson(asMap(await _api.get(_msg(mailboxId, messageId))));

  Future<JsonMap> messageHeaders(String mailboxId, String messageId) async =>
      asMap(await _api.get('${_msg(mailboxId, messageId)}/headers'));

  Future<LabelCounts> labelCounts(String mailboxId) async => LabelCounts.fromJson(
    asMap(await _api.get('${_mb(mailboxId)}/inbox/label-counts')),
  );

  Future<SyncStatus> syncStatus(String mailboxId) async => SyncStatus.fromJson(
    asMap(await _api.get('${_mb(mailboxId)}/inbox/sync-status')),
  );

  /// `recent` pulls new mail; `full` restarts the initial sync.
  Future<void> sync(String mailboxId, {String mode = 'recent'}) =>
      _api.post('${_mb(mailboxId)}/inbox/sync', body: {'mode': mode});

  Future<void> archive(String mailboxId, String messageId) =>
      _api.post('${_msg(mailboxId, messageId)}/archive');

  Future<void> trash(String mailboxId, String messageId) =>
      _api.post('${_msg(mailboxId, messageId)}/trash');

  /// Permanently deletes the message.
  Future<void> delete(String mailboxId, String messageId) =>
      _api.post('${_msg(mailboxId, messageId)}/delete');

  Future<void> markRead(String mailboxId, String messageId) =>
      _api.post('${_msg(mailboxId, messageId)}/mark-read');

  Future<void> markUnread(String mailboxId, String messageId) =>
      _api.post('${_msg(mailboxId, messageId)}/mark-unread');

  Future<void> applyLabel(String mailboxId, String messageId, String label) =>
      _api.post('${_msg(mailboxId, messageId)}/label', body: {'label': label});

  Future<void> snooze(String mailboxId, String messageId, DateTime until) =>
      _api.post(
        '${_msg(mailboxId, messageId)}/snooze',
        body: {'snoozeUntil': until.toUtc().toIso8601String()},
      );

  // --- Sending ---

  Future<void> send(String mailboxId, OutgoingEmail email) =>
      _api.post('${_mb(mailboxId)}/send', body: email.toJson());

  /// Queues the email a few seconds out so it can still be cancelled
  /// (cancel with [cancelScheduled] using the returned id).
  Future<UndoableSend> sendWithUndo(String mailboxId, OutgoingEmail email) async {
    final data = asMap(
      await _api.post('${_mb(mailboxId)}/send-with-undo', body: email.toJson()),
    );
    return UndoableSend(
      scheduledEmailId: readString(data, 'scheduledEmailId'),
      sendAt: readDate(data, 'sendAt'),
    );
  }

  Future<void> schedule(String mailboxId, OutgoingEmail email, DateTime at) =>
      _api.post(
        '${_mb(mailboxId)}/schedule',
        body: {...email.toJson(), 'scheduledAt': at.toUtc().toIso8601String()},
      );

  // --- Drafts ---

  Future<List<DraftSummary>> listDrafts(String mailboxId) async => asMapList(
    asMap(await _api.get('${_mb(mailboxId)}/drafts'))['drafts'],
  ).map(DraftSummary.fromJson).toList();

  Future<DraftDetail> getDraft(String mailboxId, String draftId) async =>
      DraftDetail.fromJson(
        asMap(
          await _api.get('${_mb(mailboxId)}/drafts/${Uri.encodeComponent(draftId)}'),
        ),
      );

  /// Creates (no [draftId]) or updates a draft; returns its id.
  Future<String?> saveDraft(
    String mailboxId,
    OutgoingEmail email, {
    String? draftId,
  }) async {
    final data = asMap(
      await _api.post(
        '${_mb(mailboxId)}/drafts',
        body: {
          'draftId': ?draftId,
          ...email.toJson(requireAll: false),
        },
      ),
    );
    return readStringOrNull(data, 'draftId');
  }

  Future<void> sendDraft(String mailboxId, String draftId) => _api.post(
    '${_mb(mailboxId)}/drafts/${Uri.encodeComponent(draftId)}/send',
  );

  Future<void> deleteDraft(String mailboxId, String draftId) => _api.post(
    '${_mb(mailboxId)}/drafts/${Uri.encodeComponent(draftId)}/delete',
  );

  // --- Scheduled & snoozed ---

  Future<List<ScheduledEmail>> listScheduled(String mailboxId) async =>
      asMapList(
        asMap(await _api.get('${_mb(mailboxId)}/scheduled'))['scheduled'],
      ).map(ScheduledEmail.fromJson).toList();

  Future<void> cancelScheduled(String mailboxId, String id) => _api.post(
    '${_mb(mailboxId)}/scheduled/${Uri.encodeComponent(id)}/cancel',
  );

  Future<List<SnoozedEmail>> listSnoozed(String mailboxId) async => asMapList(
    asMap(await _api.get('${_mb(mailboxId)}/snoozed'))['snoozed'],
  ).map(SnoozedEmail.fromJson).toList();

  Future<void> cancelSnooze(String mailboxId, String id) => _api.post(
    '${_mb(mailboxId)}/snoozed/${Uri.encodeComponent(id)}/cancel',
  );

  // --- Reminders ---

  Future<List<Reminder>> listReminders(String mailboxId) async => asMapList(
    asMap(await _api.get('${_mb(mailboxId)}/reminders'))['reminders'],
  ).map(Reminder.fromJson).toList();

  Future<void> createReminder(String mailboxId, String text, DateTime at) =>
      _api.post(
        '${_mb(mailboxId)}/reminders',
        body: {'text': text, 'remindAt': at.toUtc().toIso8601String()},
      );

  Future<void> cancelReminder(String mailboxId, String id) => _api.post(
    '${_mb(mailboxId)}/reminders/${Uri.encodeComponent(id)}/cancel',
  );

  // --- Real-time ---

  /// SSE stream that emits whenever new mail arrives for the mailbox.
  Stream<String> inboxEvents(String mailboxId) =>
      _api.sse('${_mb(mailboxId)}/inbox/events');
}
