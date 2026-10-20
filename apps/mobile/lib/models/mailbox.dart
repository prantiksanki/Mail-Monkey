import 'json.dart';

/// A connected mailbox (`GET /api/users/connected-mailboxes`).
class Mailbox {
  const Mailbox({
    required this.id,
    required this.email,
    required this.provider,
    this.name,
    this.picture,
    this.watchEnabled = false,
    this.emailSyncComplete = false,
    this.watchExpiry,
  });

  final String id;
  final String email;

  /// `GOOGLE`, `OUTLOOK` or `IMAP` (Prisma enum MailboxProvider).
  final String provider;
  final String? name;
  final String? picture;
  final bool watchEnabled;
  final bool emailSyncComplete;

  /// When the provider push subscription lapses (Gmail watch / Graph).
  final DateTime? watchExpiry;

  /// Web MailboxesPage `getMailboxHealth`: expired → reconnect, paused →
  /// attention, otherwise healthy.
  String get health {
    if (watchExpiry != null && watchExpiry!.isBefore(DateTime.now())) return 'reconnect';
    return watchEnabled ? 'healthy' : 'attention';
  }

  bool get isGoogle => provider == 'GOOGLE';
  bool get isOutlook => provider == 'OUTLOOK';
  bool get isImap => provider == 'IMAP';

  String get displayName => (name != null && name!.trim().isNotEmpty) ? name! : email;

  String get providerLabel => switch (provider) {
    'GOOGLE' => 'Gmail',
    'OUTLOOK' => 'Outlook',
    'IMAP' => 'Custom email',
    _ => provider,
  };

  factory Mailbox.fromJson(JsonMap json) => Mailbox(
    id: readString(json, 'id'),
    email: readString(json, 'email'),
    provider: readString(json, 'provider'),
    name: readStringOrNull(json, 'name'),
    picture: readStringOrNull(json, 'picture'),
    watchEnabled: readBool(json, 'watchEnabled'),
    emailSyncComplete: readBool(json, 'emailSyncComplete'),
    watchExpiry: readDate(json, 'watchExpiry'),
  );
}
