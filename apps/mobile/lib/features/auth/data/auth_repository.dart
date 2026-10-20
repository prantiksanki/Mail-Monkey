import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../../../core/config/env.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/network/api_client.dart';
import '../../../core/security/pkce.dart';
import '../../../core/security/token_store.dart';
import '../../../models/json.dart';
import '../../../models/session.dart';

/// Opens a URL in the system browser (Custom Tabs / ASWebAuthenticationSession)
/// and returns the final callback URL. Google blocks OAuth in embedded
/// web views, so this must never be a WebView.
abstract interface class WebAuthenticator {
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  });
}

class SystemBrowserAuthenticator implements WebAuthenticator {
  const SystemBrowserAuthenticator();

  @override
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  }) => FlutterWebAuth2.authenticate(
    url: url,
    callbackUrlScheme: callbackUrlScheme,
  );
}

/// Sign-in providers supported by the backend's social sign-in.
enum SignInProvider {
  google('google'),
  microsoft('microsoft');

  const SignInProvider(this.id);
  final String id;
}

class AuthException implements Exception {
  const AuthException(this.code);

  /// `cancelled`, or an error code from mobile-auth (`access_denied`,
  /// `provider_unavailable`, `no_session`, `invalid_request`, `invalid_grant`).
  final String code;

  String get userMessage => switch (code) {
    'cancelled' => 'Sign-in was cancelled.',
    'access_denied' => 'Access was denied. Please allow Mail Monkey to continue.',
    'provider_unavailable' => 'This sign-in option isn\'t available right now.',
    'invalid_grant' => 'The sign-in link expired. Please try again.',
    _ => 'Sign-in failed. Please try again.',
  };

  @override
  String toString() => 'AuthException($code)';
}

class AuthRepository {
  AuthRepository({
    required this._api,
    required this._tokenStore,
    this._authenticator = const SystemBrowserAuthenticator(),
    this._baseUrl = Env.apiBaseUrl,
  });

  final ApiClient _api;
  final TokenStore _tokenStore;
  final WebAuthenticator _authenticator;
  final String _baseUrl;

  Future<bool> hasToken() async => (await _tokenStore.read()) != null;

  /// Current session, or null when signed out / the token was revoked.
  Future<AppSession?> currentSession() async {
    if (!await hasToken()) return null;
    try {
      final data = await _api.get('/auth/get-session');
      final session = AppSession.fromJson(data);
      if (session == null) await _tokenStore.clear();
      return session;
    } on ApiException catch (e) {
      if (e.isUnauthorized) {
        await _tokenStore.clear();
        return null;
      }
      rethrow;
    }
  }

  /// Browser sign-in with PKCE (see packages/api/lib/mobile-auth.ts):
  /// start → provider consent → complete → mailmonkey://auth-callback?code
  /// → exchange(code, verifier) → bearer token.
  Future<AppSession> signIn(SignInProvider provider) async {
    final pkce = PkcePair.generate();
    final startUrl = Uri.parse('$_baseUrl/api/mobile-auth/start').replace(
      queryParameters: {'provider': provider.id, 'challenge': pkce.challenge},
    );

    final String result;
    try {
      result = await _authenticator.authenticate(
        url: startUrl.toString(),
        callbackUrlScheme: Env.authCallbackScheme,
      );
    } on Exception catch (e) {
      // flutter_web_auth_2 reports a closed browser as PlatformException
      // with code CANCELED.
      if (e.toString().contains('CANCELED')) {
        throw const AuthException('cancelled');
      }
      rethrow;
    }

    final callback = Uri.parse(result);
    final error = callback.queryParameters['error'];
    if (error != null) throw AuthException(error);
    final code = callback.queryParameters['code'];
    if (code == null || code.isEmpty) {
      throw const AuthException('invalid_request');
    }

    final dynamic response;
    try {
      response = await _api.post(
        '/mobile-auth/exchange',
        body: {'code': code, 'verifier': pkce.verifier},
      );
    } on ApiException catch (e) {
      throw AuthException(e.isValidation ? 'invalid_grant' : 'unknown');
    }
    final token = readStringOrNull(asMap(response), 'token');
    if (token == null || token.isEmpty) {
      throw const AuthException('invalid_grant');
    }
    await _tokenStore.write(token);

    final session = await currentSession();
    if (session == null) throw const AuthException('no_session');
    return session;
  }

  /// Revokes the session on the server, then forgets it locally (even if
  /// the server call fails, e.g. offline).
  Future<void> signOut() async {
    try {
      await _api.post('/auth/sign-out');
    } on ApiException {
      // Local sign-out still proceeds.
    } finally {
      await _tokenStore.clear();
    }
  }
}
