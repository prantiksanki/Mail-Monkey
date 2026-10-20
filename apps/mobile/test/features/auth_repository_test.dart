import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/core/network/api_client.dart';
import 'package:mail_monkey/core/security/pkce.dart';
import 'package:mail_monkey/core/security/token_store.dart';
import 'package:mail_monkey/features/auth/data/auth_repository.dart';

import '../support/fake_http.dart';

class FakeAuthenticator implements WebAuthenticator {
  FakeAuthenticator(this.respond);

  final Future<String> Function(Uri startUrl) respond;
  Uri? openedUrl;

  @override
  Future<String> authenticate({required String url, required String callbackUrlScheme}) {
    openedUrl = Uri.parse(url);
    expect(callbackUrlScheme, 'mailmonkey');
    return respond(openedUrl!);
  }
}

const _session = {
  'session': {'id': 's1', 'expiresAt': '2026-11-01T00:00:00.000Z'},
  'user': {'id': 'u1', 'name': 'Sanyam Goyal', 'email': 'sanyam@example.com'},
};

void main() {
  late MemoryTokenStore tokens;
  late FakeAdapter adapter;
  late AuthRepository repo;
  String? capturedVerifier;

  AuthRepository build(FakeAuthenticator auth) => AuthRepository(
    api: ApiClient(tokenStore: tokens, dio: fakeDio(adapter)),
    tokenStore: tokens,
    authenticator: auth,
    baseUrl: 'http://test',
  );

  setUp(() {
    tokens = MemoryTokenStore();
    capturedVerifier = null;
    adapter = FakeAdapter((req) {
      if (req.path == '/mobile-auth/exchange') {
        final body = req.body! as Map;
        capturedVerifier = body['verifier'] as String;
        return body['code'] == 'good-code'
            ? const FakeResponse(200, {'token': 'tok.sig'})
            : const FakeResponse(400, {'error': 'invalid_grant'});
      }
      if (req.path == '/auth/get-session') {
        return req.authorization == 'Bearer tok.sig'
            ? const FakeResponse(200, _session)
            : const FakeResponse(200, null);
      }
      return const FakeResponse(404, {'code': 'NOT_FOUND'});
    });
  });

  test('signs in: browser start → code → PKCE exchange → stored token', () async {
    final auth = FakeAuthenticator((_) async => 'mailmonkey://auth-callback?code=good-code');
    repo = build(auth);

    final session = await repo.signIn(SignInProvider.google);

    final start = auth.openedUrl!;
    expect(start.path, '/api/mobile-auth/start');
    expect(start.queryParameters['provider'], 'google');
    // The challenge sent to the browser is derived from the verifier that
    // only the exchange receives.
    expect(PkcePair.challengeFor(capturedVerifier!), start.queryParameters['challenge']);
    expect(await tokens.read(), 'tok.sig');
    expect(session.user.email, 'sanyam@example.com');
    expect(session.user.initials, 'SG');
  });

  test('surfaces provider errors from the callback', () async {
    repo = build(FakeAuthenticator((_) async => 'mailmonkey://auth-callback?error=access_denied'));

    await expectLater(
      repo.signIn(SignInProvider.google),
      throwsA(isA<AuthException>().having((e) => e.code, 'code', 'access_denied')),
    );
    expect(await tokens.read(), isNull);
  });

  test('treats a closed browser as cancelled', () async {
    repo = build(FakeAuthenticator((_) async => throw PlatformException(code: 'CANCELED')));

    await expectLater(
      repo.signIn(SignInProvider.google),
      throwsA(isA<AuthException>().having((e) => e.code, 'code', 'cancelled')),
    );
  });

  test('rejects an invalid or expired code', () async {
    repo = build(FakeAuthenticator((_) async => 'mailmonkey://auth-callback?code=stale'));

    await expectLater(
      repo.signIn(SignInProvider.google),
      throwsA(isA<AuthException>().having((e) => e.code, 'code', 'invalid_grant')),
    );
    expect(await tokens.read(), isNull);
  });

  test('currentSession clears a token the server no longer accepts', () async {
    await tokens.write('revoked.token');
    repo = build(FakeAuthenticator((_) async => ''));

    expect(await repo.currentSession(), isNull);
    expect(await tokens.read(), isNull);
  });

  test('signOut clears the token even when the server call fails', () async {
    await tokens.write('tok.sig');
    repo = build(FakeAuthenticator((_) async => ''));

    await repo.signOut();

    expect(await tokens.read(), isNull);
    expect(adapter.requests.last.path, '/auth/sign-out');
  });
}
