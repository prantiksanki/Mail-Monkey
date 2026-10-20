import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../core/config/env.dart';
import '../core/network/api_client.dart';
import '../models/account.dart';
import '../models/json.dart';

/// Account settings: Better Auth's user/session/2FA endpoints plus avatar
/// upload (web settings General / Security / Danger zone).
class AccountService {
  AccountService(this._api, {Dio? uploader}) : _uploader = uploader ?? Dio();

  final ApiClient _api;

  /// Bare client for signed storage URLs — must never carry the session
  /// token or the API base URL.
  final Dio _uploader;

  /// `name`, `image`, `locale`, `accountType`, `onboardingComplete`.
  Future<void> updateUser(JsonMap fields) => _api.post('/auth/update-user', body: fields);

  /// Sends a confirmation link to the new address (web ChangeEmailForm).
  Future<void> changeEmail(String newEmail) => _api.post(
    '/auth/change-email',
    body: {'newEmail': newEmail, 'callbackURL': '${Env.apiBaseUrl}/app/settings/general'},
  );

  /// Mails a confirmation link; the account is deleted only once it's opened.
  Future<void> deleteUser() => _api.post('/auth/delete-user', body: <String, dynamic>{});

  Future<List<ActiveSession>> listSessions() async =>
      asMapList(await _api.get('/auth/list-sessions')).map(ActiveSession.fromJson).toList();

  Future<void> revokeSession(String token) => _api.post('/auth/revoke-session', body: {'token': token});

  Future<List<LinkedAccount>> listAccounts() async =>
      asMapList(await _api.get('/auth/list-accounts')).map(LinkedAccount.fromJson).toList();

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
    bool revokeOtherSessions = false,
  }) => _api.post(
    '/auth/change-password',
    body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
      'revokeOtherSessions': revokeOtherSessions,
    },
  );

  /// Returns the `otpauth://` URI to add to an authenticator app.
  Future<String> enableTwoFactor(String password) async =>
      readString(asMap(await _api.post('/auth/two-factor/enable', body: {'password': password})), 'totpURI');

  Future<void> verifyTotp(String code) => _api.post('/auth/two-factor/verify-totp', body: {'code': code});

  Future<void> disableTwoFactor(String password) =>
      _api.post('/auth/two-factor/disable', body: {'password': password});

  /// Uploads a PNG avatar and stores its cache-busted path on the user.
  Future<String> uploadAvatar(Uint8List png) async {
    final target = asMap(await _api.post('/users/avatar-upload-url', body: <String, dynamic>{}));
    await putSigned(readString(target, 'signedUploadUrl'), png);
    final path = '${readString(target, 'path')}?v=${DateTime.now().millisecondsSinceEpoch}';
    await updateUser({'image': path});
    return path;
  }

  /// PUTs bytes to a signed storage URL (S3 or Azure SAS).
  Future<void> putSigned(String url, Uint8List bytes, {String contentType = 'image/png'}) async {
    await _uploader.put<void>(
      url,
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: {
          Headers.contentTypeHeader: contentType,
          Headers.contentLengthHeader: bytes.length,
          // Required by Azure Blob Storage SAS uploads; ignored by S3.
          'x-ms-blob-type': 'BlockBlob',
        },
      ),
    );
  }
}

/// Settings → Integrations and custom (IMAP) mailboxes.
class IntegrationsService {
  IntegrationsService(this._api);

  final ApiClient _api;

  Future<TelegramStatus> telegramStatus() async => TelegramStatus.fromJson(asMap(await _api.get('/telegram/status')));

  /// Short-lived `t.me` deep link that connects this account's chat.
  Future<({String url, DateTime? expiresAt})> telegramLink() async {
    final data = asMap(await _api.post('/telegram/link'));
    return (url: readString(data, 'url'), expiresAt: readDate(data, 'expiresAt'));
  }

  /// Pauses delivery (web "disconnect").
  Future<void> telegramPause() => _api.post('/telegram/disconnect');

  Future<void> telegramResume() => _api.post('/telegram/resume');

  /// [provider]: `zoom` or `zoho`.
  Future<MeetingProviderStatus> meetingStatus(String provider) async =>
      MeetingProviderStatus.fromJson(asMap(await _api.get('/$provider/status')));

  Future<void> meetingDisconnect(String provider) => _api.post('/$provider/disconnect');

  Future<bool> verifyImap(ImapSettings settings) async =>
      readBool(asMap(await _api.post('/mailboxes/verify-imap', body: settings.toJson())), 'verified');

  Future<({String mailboxId, String email})> connectImap(ImapSettings settings) async {
    final data = asMap(await _api.post('/mailboxes/connect-imap', body: settings.toJson()));
    return (mailboxId: readString(data, 'mailboxId'), email: readString(data, 'email'));
  }

  /// Completes a custom-email connection started before sign-up (web
  /// PendingImapMailboxConnector). Returns the connected address, if any.
  Future<String?> finishPendingImap() async {
    final data = asMap(await _api.post('/mailboxes/finish-pending-imap', body: <String, dynamic>{}));
    return readBool(data, 'connected') ? readString(data, 'email') : null;
  }
}

/// Settings → Billing (packages/api/modules/payments).
class BillingService {
  BillingService(this._api);

  final ApiClient _api;

  Future<List<Purchase>> purchases() async =>
      asMapList(asMap(await _api.get('/payments/purchases'))['purchases']).map(Purchase.fromJson).toList();

  Future<DateTime?> startTrial() async =>
      readDate(asMap(await _api.post('/payments/start-trial', body: <String, dynamic>{})), 'trialEndsAt');

  Future<String> checkoutLink({required String productId, String type = 'subscription'}) async => readString(
    asMap(
      await _api.post(
        '/payments/create-checkout-link',
        body: {'type': type, 'productId': productId, 'redirectUrl': '${Env.apiBaseUrl}/app/settings/billing'},
      ),
    ),
    'checkoutLink',
  );

  Future<String> customerPortalLink(String purchaseId) async => readString(
    asMap(
      await _api.post(
        '/payments/create-customer-portal-link',
        body: {'purchaseId': purchaseId, 'redirectUrl': '${Env.apiBaseUrl}/app/settings/billing'},
      ),
    ),
    'customerPortalLink',
  );
}

/// Admin (role `admin` only; the server enforces it).
class AdminService {
  AdminService(this._api);

  final ApiClient _api;

  Future<({List<AdminUser> users, int total})> users({String? query, int limit = 25, int offset = 0}) async {
    final data = asMap(await _api.get('/admin/users', query: {'query': query, 'limit': limit, 'offset': offset}));
    return (users: asMapList(data['users']).map(AdminUser.fromJson).toList(), total: readInt(data, 'total'));
  }

  Future<({List<AdminOrganization> organizations, int total})> organizations({
    String? query,
    int limit = 25,
    int offset = 0,
  }) async {
    final data = asMap(
      await _api.get('/admin/organizations', query: {'query': query, 'limit': limit, 'offset': offset}),
    );
    return (
      organizations: asMapList(data['organizations']).map(AdminOrganization.fromJson).toList(),
      total: readInt(data, 'total'),
    );
  }
}
