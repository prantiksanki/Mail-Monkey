import 'json.dart';

/// Email being sent, scheduled or saved as a draft. Recipient fields are
/// comma-separated address lists, as on the web compose dialog.
class OutgoingEmail {
  const OutgoingEmail({
    required this.to,
    required this.subject,
    required this.body,
    this.cc = '',
    this.bcc = '',
  });

  final String to;
  final String cc;
  final String bcc;
  final String subject;
  final String body;

  /// The backend requires to/subject/body for sending; drafts accept any
  /// subset ([requireAll] false omits empty fields).
  JsonMap toJson({bool requireAll = true}) => {
    if (requireAll || to.isNotEmpty) 'to': to,
    if (requireAll || subject.isNotEmpty) 'subject': subject,
    if (requireAll || body.isNotEmpty) 'body': body,
    if (cc.trim().isNotEmpty) 'cc': cc.trim(),
    if (bcc.trim().isNotEmpty) 'bcc': bcc.trim(),
  };
}

class UndoableSend {
  const UndoableSend({required this.scheduledEmailId, this.sendAt});

  final String scheduledEmailId;
  final DateTime? sendAt;
}

class DraftSummary {
  const DraftSummary({
    required this.draftId,
    required this.to,
    required this.subject,
    required this.snippet,
    this.messageId,
    this.date,
  });

  final String draftId;
  final String? messageId;
  final String to;
  final String subject;
  final String snippet;
  final DateTime? date;

  factory DraftSummary.fromJson(JsonMap json) => DraftSummary(
    draftId: readString(json, 'draftId'),
    messageId: readStringOrNull(json, 'messageId'),
    to: readString(json, 'to'),
    subject: readString(json, 'subject'),
    snippet: readString(json, 'snippet'),
    date: readDate(json, 'date'),
  );
}

class DraftDetail {
  const DraftDetail({
    required this.draftId,
    required this.to,
    required this.cc,
    required this.bcc,
    required this.subject,
    required this.body,
  });

  final String draftId;
  final String to;
  final String cc;
  final String bcc;
  final String subject;
  final String body;

  factory DraftDetail.fromJson(JsonMap json) => DraftDetail(
    draftId: readString(json, 'draftId'),
    to: readString(json, 'to'),
    cc: readString(json, 'cc'),
    bcc: readString(json, 'bcc'),
    subject: readString(json, 'subject'),
    body: readString(json, 'body'),
  );
}

class ScheduledEmail {
  const ScheduledEmail({
    required this.id,
    required this.to,
    required this.subject,
    this.scheduledAt,
  });

  final String id;
  final String to;
  final String subject;
  final DateTime? scheduledAt;

  factory ScheduledEmail.fromJson(JsonMap json) => ScheduledEmail(
    id: readString(json, 'id'),
    to: readString(json, 'to'),
    subject: readString(json, 'subject'),
    scheduledAt: readDate(json, 'scheduledAt'),
  );
}

class SnoozedEmail {
  const SnoozedEmail({
    required this.id,
    required this.messageId,
    required this.from,
    required this.subject,
    required this.snippet,
    this.snoozeUntil,
    this.internalDate,
  });

  final String id;
  final String messageId;
  final String from;
  final String subject;
  final String snippet;
  final DateTime? snoozeUntil;
  final DateTime? internalDate;

  factory SnoozedEmail.fromJson(JsonMap json) => SnoozedEmail(
    id: readString(json, 'id'),
    messageId: readString(json, 'messageId'),
    from: readString(json, 'from'),
    subject: readString(json, 'subject'),
    snippet: readString(json, 'snippet'),
    snoozeUntil: readDate(json, 'snoozeUntil'),
    internalDate: readDate(json, 'internalDate'),
  );
}

class Reminder {
  const Reminder({required this.id, required this.text, this.remindAt});

  final String id;
  final String text;
  final DateTime? remindAt;

  factory Reminder.fromJson(JsonMap json) => Reminder(
    id: readString(json, 'id'),
    text: readString(json, 'text'),
    remindAt: readDate(json, 'remindAt'),
  );
}
