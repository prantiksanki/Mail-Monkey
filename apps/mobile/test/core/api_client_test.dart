import 'package:flutter_test/flutter_test.dart';
import 'package:mail_monkey/core/errors/api_exception.dart';
import 'package:mail_monkey/core/network/api_client.dart';
import 'package:mail_monkey/core/security/pkce.dart';
import 'package:mail_monkey/core/security/token_store.dart';

import '../support/fake_http.dart';

void main() {
  group('ApiClient', () {
    test('sends the stored session token as a bearer header', () async {
      final adapter = FakeAdapter((_) => const FakeResponse(200, {'ok': true}));
      final api = ApiClient(tokenStore: MemoryTokenStore('tok.sig'), dio: fakeDio(adapter));

      await api.get('/users/connected-mailboxes');

      expect(adapter.requests.single.authorization, 'Bearer tok.sig');
    });

    test('sends no Authorization header when signed out', () async {
      final adapter = FakeAdapter((_) => const FakeResponse(200, {}));
      final api = ApiClient(tokenStore: MemoryTokenStore(), dio: fakeDio(adapter));

      await api.get('/auth/get-session');

      expect(adapter.requests.single.authorization, isNull);
    });

    test('drops null and empty query parameters', () async {
      final adapter = FakeAdapter((_) => const FakeResponse(200, {}));
      final api = ApiClient(tokenStore: MemoryTokenStore(), dio: fakeDio(adapter));

      await api.get('/x', query: {'folder': 'inbox', 'label': null, 'search': '', 'maxResults': 50});

      expect(adapter.requests.single.query, {'folder': 'inbox', 'maxResults': 50});
    });

    test('maps the backend oRPC error shape to ApiException', () async {
      final adapter = FakeAdapter(
        (_) => const FakeResponse(429, {
          'defined': false,
          'code': 'TOO_MANY_REQUESTS',
          'status': 429,
          'message': 'Gmail is temporarily limiting requests',
        }),
      );
      final api = ApiClient(tokenStore: MemoryTokenStore(), dio: fakeDio(adapter));

      await expectLater(
        api.get('/mailboxes/m1/inbox'),
        throwsA(
          isA<ApiException>()
              .having((e) => e.code, 'code', 'TOO_MANY_REQUESTS')
              .having((e) => e.isRateLimited, 'isRateLimited', true)
              .having((e) => e.userMessage, 'userMessage', contains('limiting')),
        ),
      );
    });

    test('reports 401 through onUnauthorized', () async {
      var called = 0;
      final adapter = FakeAdapter(
        (_) => const FakeResponse(401, {'code': 'UNAUTHORIZED', 'status': 401, 'message': 'Unauthorized'}),
      );
      final api = ApiClient(
        tokenStore: MemoryTokenStore('t.s'),
        dio: fakeDio(adapter),
        onUnauthorized: () => called++,
      );

      await expectLater(api.get('/users/connected-mailboxes'), throwsA(isA<ApiException>()));
      expect(called, 1);
    });

    test('classifies connection failures as network errors', () async {
      final adapter = FakeAdapter((_) => const FakeResponse(200))..throwOnFetch = true;
      final api = ApiClient(tokenStore: MemoryTokenStore(), dio: fakeDio(adapter));

      await expectLater(
        api.get('/health'),
        throwsA(isA<ApiException>().having((e) => e.isNetwork, 'isNetwork', true)),
      );
    });

    test('server errors get a generic user message', () {
      const e = ApiException(code: 'INTERNAL_SERVER_ERROR', message: 'stack trace…', status: 500);
      expect(e.userMessage, isNot(contains('stack')));
    });
  });

  group('PKCE', () {
    test('matches the RFC 7636 appendix B test vector', () {
      expect(
        PkcePair.challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'),
        'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      );
    });

    test('generates a 43-char verifier and a matching challenge', () {
      final pair = PkcePair.generate();
      expect(pair.verifier, matches(RegExp(r'^[A-Za-z0-9_-]{43}$')));
      expect(pair.challenge, PkcePair.challengeFor(pair.verifier));
      expect(PkcePair.generate().verifier, isNot(pair.verifier));
    });
  });
}
