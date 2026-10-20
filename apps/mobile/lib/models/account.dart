import 'json.dart';

/// A Better Auth session row (`GET /api/auth/list-sessions`).
class ActiveSession {
  const ActiveSession({
    required this.id,
    required this.token,
    this.ipAddress,
    this.userAgent,
    this.createdAt,
    this.expiresAt,
  });

  final String id;
  final String token;
  final String? ipAddress;
  final String? userAgent;
  final DateTime? createdAt;
  final DateTime? expiresAt;

  factory ActiveSession.fromJson(JsonMap json) => ActiveSession(
    id: readString(json, 'id'),
    token: readString(json, 'token'),
    ipAddress: readStringOrNull(json, 'ipAddress'),
    userAgent: readStringOrNull(json, 'userAgent'),
    createdAt: readDate(json, 'createdAt'),
    expiresAt: readDate(json, 'expiresAt'),
  );
}

/// A linked sign-in method (`GET /api/auth/list-accounts`).
class LinkedAccount {
  const LinkedAccount({required this.id, required this.providerId, required this.accountId, this.createdAt});

  final String id;
  final String providerId;
  final String accountId;
  final DateTime? createdAt;

  factory LinkedAccount.fromJson(JsonMap json) => LinkedAccount(
    id: readString(json, 'id'),
    providerId: readString(json, 'providerId'),
    accountId: readString(json, 'accountId'),
    createdAt: readDate(json, 'createdAt'),
  );
}

class TelegramStatus {
  const TelegramStatus({
    required this.connected,
    required this.enabled,
    this.username,
    this.firstName,
    this.lastName,
    this.timezone = '',
    this.dailyDigestTime = '',
    this.updatedAt,
  });

  final bool connected;
  final bool enabled;
  final String? username;
  final String? firstName;
  final String? lastName;
  final String timezone;
  final String dailyDigestTime;
  final String? updatedAt;

  String get displayName {
    final full = [firstName, lastName].whereType<String>().where((s) => s.isNotEmpty).join(' ');
    return (username?.isNotEmpty ?? false) ? '@$username' : (full.isNotEmpty ? full : 'Telegram');
  }

  factory TelegramStatus.fromJson(JsonMap json) => TelegramStatus(
    connected: readBool(json, 'connected'),
    enabled: readBool(json, 'enabled'),
    username: readStringOrNull(json, 'username'),
    firstName: readStringOrNull(json, 'firstName'),
    lastName: readStringOrNull(json, 'lastName'),
    timezone: readString(json, 'timezone'),
    dailyDigestTime: readString(json, 'dailyDigestTime'),
    updatedAt: readStringOrNull(json, 'updatedAt'),
  );
}

/// Zoom / Zoho Meeting connection (`GET /api/{zoom|zoho}/status`).
class MeetingProviderStatus {
  const MeetingProviderStatus({required this.connected, required this.configured});

  final bool connected;
  final bool configured;

  factory MeetingProviderStatus.fromJson(JsonMap json) => MeetingProviderStatus(
    connected: readBool(json, 'connected'),
    // Zoom's status may omit `configured`; treat it as available.
    configured: readBool(json, 'configured', true),
  );
}

/// IMAP/SMTP settings for a custom mailbox (mailboxes.verifyImap/connectImap).
class ImapSettings {
  const ImapSettings({
    required this.email,
    required this.password,
    required this.imapHost,
    required this.smtpHost,
    this.imapPort = 993,
    this.imapSecure = true,
    this.smtpPort = 465,
    this.smtpSecure = true,
  });

  final String email;
  final String password;
  final String imapHost;
  final String smtpHost;
  final int imapPort;
  final bool imapSecure;
  final int smtpPort;
  final bool smtpSecure;

  JsonMap toJson() => {
    'email': email,
    'password': password,
    'imapHost': imapHost,
    'smtpHost': smtpHost,
    'imapPort': imapPort,
    'imapSecure': imapSecure,
    'smtpPort': smtpPort,
    'smtpSecure': smtpSecure,
  };
}

class Purchase {
  const Purchase({
    required this.id,
    required this.type,
    required this.productId,
    required this.customerId,
    this.status,
    this.trialEndsAt,
    this.createdAt,
  });

  final String id;

  /// `SUBSCRIPTION` or `ONE_TIME`.
  final String type;
  final String productId;
  final String customerId;
  final String? status;
  final DateTime? trialEndsAt;
  final DateTime? createdAt;

  bool get isTrial => customerId == 'trial';

  factory Purchase.fromJson(JsonMap json) => Purchase(
    id: readString(json, 'id'),
    type: readString(json, 'type'),
    productId: readString(json, 'productId'),
    customerId: readString(json, 'customerId'),
    status: readStringOrNull(json, 'status'),
    trialEndsAt: readDate(json, 'trialEndsAt'),
    createdAt: readDate(json, 'createdAt'),
  );
}

class AdminUser {
  const AdminUser({
    required this.id,
    required this.name,
    required this.email,
    this.image,
    this.role,
    this.accountType = 'STANDARD',
    this.emailVerified = false,
    this.banned = false,
    this.createdAt,
  });

  final String id;
  final String name;
  final String email;
  final String? image;
  final String? role;
  final String accountType;
  final bool emailVerified;
  final bool banned;
  final DateTime? createdAt;

  factory AdminUser.fromJson(JsonMap json) => AdminUser(
    id: readString(json, 'id'),
    name: readString(json, 'name'),
    email: readString(json, 'email'),
    image: readStringOrNull(json, 'image'),
    role: readStringOrNull(json, 'role'),
    accountType: readString(json, 'accountType', 'STANDARD'),
    emailVerified: readBool(json, 'emailVerified'),
    banned: readBool(json, 'banned'),
    createdAt: readDate(json, 'createdAt'),
  );
}

class AdminOrganization {
  const AdminOrganization({required this.id, required this.name, this.slug, this.membersCount = 0, this.createdAt});

  final String id;
  final String name;
  final String? slug;
  final int membersCount;
  final DateTime? createdAt;

  factory AdminOrganization.fromJson(JsonMap json) => AdminOrganization(
    id: readString(json, 'id'),
    name: readString(json, 'name'),
    slug: readStringOrNull(json, 'slug'),
    membersCount: readInt(json, 'membersCount'),
    createdAt: readDate(json, 'createdAt'),
  );
}
