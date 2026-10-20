import 'package:intl/intl.dart';

import 'json.dart';

/// Kanban columns of the payments board (web KanbanBoard COLUMNS).
abstract final class PaymentStatus {
  static const upcoming = 'UPCOMING';
  static const dueSoon = 'DUE_SOON';
  static const overdue = 'OVERDUE';
  static const paid = 'PAID';

  static const all = [upcoming, dueSoon, overdue, paid];

  static String label(String status) => switch (status) {
    upcoming => 'Upcoming',
    dueSoon => 'Due Soon',
    overdue => 'Overdue',
    paid => 'Paid',
    _ => status,
  };
}

/// Payment types (web PAYMENT_TYPE_LABELS), in the web's filter order.
const paymentTypeLabels = {
  'invoice': 'Invoice',
  'bill': 'Bill',
  'subscription': 'Subscription',
  'receipt': 'Receipt',
  'reminder': 'Reminder',
  'other': 'Payment',
};

class PaymentCard {
  const PaymentCard({
    required this.id,
    required this.mailboxId,
    required this.provider,
    required this.mailboxEmail,
    required this.emailId,
    required this.subject,
    required this.from,
    required this.fromEmail,
    required this.paymentType,
    required this.merchant,
    required this.kanbanStatus,
    required this.statusSource,
    this.receivedAt,
    this.amount,
    this.currency,
    this.dueDate,
  });

  final String id;
  final String mailboxId;
  final String provider;
  final String mailboxEmail;
  final String emailId;
  final String subject;
  final String from;
  final String fromEmail;
  final String paymentType;
  final String merchant;
  final String kanbanStatus;
  final String statusSource;
  final DateTime? receivedAt;
  final double? amount;
  final String? currency;
  final DateTime? dueDate;

  /// Formatted like the web's `formatAmount` (currency when recognised).
  String? get amountLabel {
    final value = amount;
    if (value == null) return null;
    final code = currency;
    if (code != null && code.length == 3) {
      try {
        return NumberFormat.simpleCurrency(name: code.toUpperCase()).format(value);
      } on Object {
        // Unrecognised currency code — fall through.
      }
    }
    return NumberFormat('#,##0.##').format(value);
  }

  String get providerLabel => switch (provider) {
    'GOOGLE' => 'Gmail',
    'OUTLOOK' => 'Outlook',
    _ => 'IMAP',
  };

  PaymentCard withStatus(String status) => PaymentCard(
    id: id,
    mailboxId: mailboxId,
    provider: provider,
    mailboxEmail: mailboxEmail,
    emailId: emailId,
    subject: subject,
    from: from,
    fromEmail: fromEmail,
    paymentType: paymentType,
    merchant: merchant,
    kanbanStatus: status,
    statusSource: 'MANUAL',
    receivedAt: receivedAt,
    amount: amount,
    currency: currency,
    dueDate: dueDate,
  );

  factory PaymentCard.fromJson(JsonMap json) => PaymentCard(
    id: readString(json, 'id'),
    mailboxId: readString(json, 'mailboxId'),
    provider: readString(json, 'provider'),
    mailboxEmail: readString(json, 'mailboxEmail'),
    emailId: readString(json, 'emailId'),
    subject: readString(json, 'subject', '(no subject)'),
    from: readString(json, 'from'),
    fromEmail: readString(json, 'fromEmail'),
    paymentType: readString(json, 'paymentType', 'other'),
    merchant: readString(json, 'merchant'),
    kanbanStatus: readString(json, 'kanbanStatus', PaymentStatus.upcoming),
    statusSource: readString(json, 'statusSource', 'AUTOMATIC'),
    receivedAt: readDate(json, 'receivedAt'),
    amount: json['amount'] == null ? null : readDouble(json, 'amount'),
    currency: readStringOrNull(json, 'currency'),
    dueDate: readDate(json, 'dueDate'),
  );
}

class PaymentAttachment {
  const PaymentAttachment({required this.id, required this.filename, required this.mimeType, required this.size});

  final String id;
  final String filename;
  final String mimeType;
  final int size;

  factory PaymentAttachment.fromJson(JsonMap json) => PaymentAttachment(
    id: readString(json, 'attachmentId'),
    filename: readString(json, 'filename', 'attachment'),
    mimeType: readString(json, 'mimeType', 'application/octet-stream'),
    size: readInt(json, 'size'),
  );
}

class PaymentCardDetail {
  const PaymentCardDetail({
    required this.card,
    required this.to,
    required this.bodyText,
    required this.bodyHtml,
    required this.attachments,
  });

  final PaymentCard card;
  final String to;
  final String bodyText;
  final String bodyHtml;
  final List<PaymentAttachment> attachments;

  factory PaymentCardDetail.fromJson(JsonMap json) => PaymentCardDetail(
    card: PaymentCard.fromJson(json),
    to: readString(json, 'to'),
    bodyText: readString(json, 'bodyText'),
    bodyHtml: readString(json, 'bodyHtml'),
    attachments: asMapList(json['attachments']).map(PaymentAttachment.fromJson).toList(),
  );
}
