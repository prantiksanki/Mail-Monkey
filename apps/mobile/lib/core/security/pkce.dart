import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// PKCE (RFC 7636, S256) pair for the mobile sign-in hand-off. Must match
/// `challengeFromVerifier` in packages/api/lib/mobile-auth.ts.
class PkcePair {
  const PkcePair({required this.verifier, required this.challenge});

  /// Kept on the device; sent only to the token exchange.
  final String verifier;

  /// base64url(SHA-256(verifier)), no padding — sent to the browser flow.
  final String challenge;

  factory PkcePair.generate([Random? random]) {
    final rng = random ?? Random.secure();
    final bytes = List<int>.generate(32, (_) => rng.nextInt(256));
    final verifier = _base64UrlNoPad(bytes);
    return PkcePair(verifier: verifier, challenge: challengeFor(verifier));
  }

  static String challengeFor(String verifier) =>
      _base64UrlNoPad(sha256.convert(ascii.encode(verifier)).bytes);

  static String _base64UrlNoPad(List<int> bytes) =>
      base64Url.encode(bytes).replaceAll('=', '');
}
