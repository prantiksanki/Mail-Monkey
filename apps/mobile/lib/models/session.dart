import 'json.dart';

/// The signed-in user, from Better Auth's `GET /api/auth/get-session`.
class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    this.image,
    this.username,
    this.role,
    this.locale,
    this.accountType = 'STANDARD',
    this.emailVerified = false,
    this.onboardingComplete = true,
    this.twoFactorEnabled = false,
    this.mustChangePassword = false,
  });

  final String id;
  final String name;
  final String email;
  final String? image;
  final String? username;
  final String? role;
  final String? locale;
  final String accountType;
  final bool emailVerified;
  final bool onboardingComplete;
  final bool twoFactorEnabled;

  /// Set for system-generated initial passwords; the app forces a change
  /// before anything else (web `/force-password-change`).
  final bool mustChangePassword;

  bool get isAdmin => role == 'admin';

  /// "Creator" / "Freelancer" accounts unlock My Page, bookings and media kit.
  bool get isCreator => accountType != 'STANDARD';

  String get initials {
    final source = name.trim().isNotEmpty ? name : email;
    final parts = source.split(RegExp(r'[\s@.]+')).where((p) => p.isNotEmpty);
    return parts.take(2).map((p) => p[0].toUpperCase()).join();
  }

  factory AppUser.fromJson(JsonMap json) => AppUser(
    id: readString(json, 'id'),
    name: readString(json, 'name'),
    email: readString(json, 'email'),
    image: readStringOrNull(json, 'image'),
    username: readStringOrNull(json, 'username'),
    role: readStringOrNull(json, 'role'),
    locale: readStringOrNull(json, 'locale'),
    accountType: readString(json, 'accountType', 'STANDARD'),
    emailVerified: readBool(json, 'emailVerified'),
    onboardingComplete: readBool(json, 'onboardingComplete', true),
    twoFactorEnabled: readBool(json, 'twoFactorEnabled'),
    mustChangePassword: readBool(json, 'mustChangePassword'),
  );
}

class AppSession {
  const AppSession({required this.user, required this.sessionId, this.expiresAt});

  final AppUser user;
  final String sessionId;
  final DateTime? expiresAt;

  /// Returns null when the server reports no session (`null` body).
  static AppSession? fromJson(Object? data) {
    if (data is! Map) return null;
    final json = asMap(data);
    final user = asMap(json['user']);
    final session = asMap(json['session']);
    if (user.isEmpty) return null;
    return AppSession(
      user: AppUser.fromJson(user),
      sessionId: readString(session, 'id'),
      expiresAt: readDate(session, 'expiresAt'),
    );
  }
}
