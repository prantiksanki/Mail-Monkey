import 'json.dart';

/// Inbox list item (`GET /api/mailboxes/{id}/inbox`).
class MessageSummary {
  const MessageSummary({
    required this.id,
    required this.threadId,
    required this.from,
    required this.fromEmail,
    required this.subject,
    required this.snippet,
    required this.labelIds,
    this.date,
    this.inTrash = false,
    this.isUnread = false,
  });

  final String id;
  final String threadId;
  final String from;
  final String fromEmail;
  final String subject;
  final String snippet;
  final DateTime? date;
  final List<String> labelIds;
  final bool inTrash;
  final bool isUnread;

  String get senderName => from.trim().isNotEmpty ? from : fromEmail;

  MessageSummary copyWith({bool? isUnread}) => MessageSummary(
    id: id,
    threadId: threadId,
    from: from,
    fromEmail: fromEmail,
    subject: subject,
    snippet: snippet,
    date: date,
    labelIds: labelIds,
    inTrash: inTrash,
    isUnread: isUnread ?? this.isUnread,
  );

  factory MessageSummary.fromJson(JsonMap json) => MessageSummary(
    id: readString(json, 'id'),
    threadId: readString(json, 'threadId'),
    from: readString(json, 'from'),
    fromEmail: readString(json, 'fromEmail'),
    subject: readString(json, 'subject'),
    snippet: readString(json, 'snippet'),
    date: readDate(json, 'date'),
    labelIds: readStringList(json, 'labelIds'),
    inTrash: readBool(json, 'inTrash'),
    isUnread: readBool(json, 'isUnread'),
  );
}

class MessagePage {
  const MessagePage({required this.messages, this.nextPageToken});

  final List<MessageSummary> messages;
  final String? nextPageToken;

  factory MessagePage.fromJson(JsonMap json) => MessagePage(
    messages: asMapList(json['messages']).map(MessageSummary.fromJson).toList(),
    nextPageToken: readStringOrNull(json, 'nextPageToken'),
  );
}

/// Received attachment metadata. The API exposes no download endpoint for
/// inbox attachments, so the app can list them but not open them.
class MessageAttachment {
  const MessageAttachment({
    required this.attachmentId,
    required this.filename,
    required this.mimeType,
    required this.size,
  });

  final String attachmentId;
  final String filename;
  final String mimeType;
  final int size;

  factory MessageAttachment.fromJson(JsonMap json) => MessageAttachment(
    attachmentId: readString(json, 'attachmentId'),
    filename: readString(json, 'filename'),
    mimeType: readString(json, 'mimeType'),
    size: readInt(json, 'size'),
  );
}

/// Full message (`GET /api/mailboxes/{id}/inbox/{messageId}`).
class MessageDetail {
  const MessageDetail({
    required this.id,
    required this.threadId,
    required this.from,
    required this.fromEmail,
    required this.to,
    required this.toEmail,
    required this.subject,
    required this.snippet,
    required this.bodyText,
    required this.bodyHtml,
    required this.labelIds,
    required this.headers,
    required this.attachments,
    this.date,
    this.isUnread = false,
  });

  final String id;
  final String threadId;
  final String from;
  final String fromEmail;
  final String to;
  final String toEmail;
  final String subject;
  final String snippet;
  final String bodyText;
  final String bodyHtml;
  final DateTime? date;
  final List<String> labelIds;
  final Map<String, String> headers;
  final List<MessageAttachment> attachments;
  final bool isUnread;

  String get senderName => from.trim().isNotEmpty ? from : fromEmail;

  /// Value of a header, case-insensitively (e.g. `cc`, `reply-to`).
  String? header(String name) {
    final lower = name.toLowerCase();
    for (final entry in headers.entries) {
      if (entry.key.toLowerCase() == lower) return entry.value;
    }
    return null;
  }

  factory MessageDetail.fromJson(JsonMap json) {
    final rawHeaders = asMap(json['headers']);
    return MessageDetail(
      id: readString(json, 'id'),
      threadId: readString(json, 'threadId'),
      from: readString(json, 'from'),
      fromEmail: readString(json, 'fromEmail'),
      to: readString(json, 'to'),
      toEmail: readString(json, 'toEmail'),
      subject: readString(json, 'subject'),
      snippet: readString(json, 'snippet'),
      bodyText: readString(json, 'bodyText'),
      bodyHtml: readString(json, 'bodyHtml'),
      date: readDate(json, 'date'),
      labelIds: readStringList(json, 'labelIds'),
      headers: {
        for (final e in rawHeaders.entries) e.key: e.value?.toString() ?? '',
      },
      attachments: asMapList(
        json['attachments'],
      ).map(MessageAttachment.fromJson).toList(),
      isUnread: readBool(json, 'isUnread'),
    );
  }
}

/// `GET /api/mailboxes/{id}/inbox/label-counts`.
class LabelCounts {
  const LabelCounts({
    required this.counts,
    required this.folderLabels,
    required this.inboxUnreadCount,
  });

  final Map<String, int> counts;
  final List<String> folderLabels;
  final int inboxUnreadCount;

  static const empty = LabelCounts(
    counts: {},
    folderLabels: [],
    inboxUnreadCount: 0,
  );

  int countFor(String label) => counts[label] ?? 0;

  factory LabelCounts.fromJson(JsonMap json) {
    final raw = asMap(json['counts']);
    return LabelCounts(
      counts: {for (final e in raw.entries) e.key: readInt(raw, e.key)},
      folderLabels: readStringList(json, 'folderLabels'),
      inboxUnreadCount: readInt(json, 'inboxUnreadCount'),
    );
  }
}

class SyncStatus {
  const SyncStatus({required this.complete, required this.syncedCount});

  final bool complete;
  final int syncedCount;

  factory SyncStatus.fromJson(JsonMap json) => SyncStatus(
    complete: readBool(json, 'complete'),
    syncedCount: readInt(json, 'syncedCount'),
  );
}
