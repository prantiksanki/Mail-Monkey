/// Build-time configuration. Nothing secret lives here: the app only needs
/// the backend's public base URL.
///
/// Set it per environment with `--dart-define`, e.g.
///   flutter run --dart-define=API_BASE_URL=https://3.7.156.194.sslip.io
///
/// The default targets the local `pnpm dev` backend. On the Android emulator
/// run `adb reverse tcp:3000 tcp:3000` first, so `localhost:3000` inside the
/// emulator (app and browser) reaches the developer's machine — that keeps
/// the Google OAuth redirect URI (`http://localhost:3000/...`) valid.
abstract final class Env {
  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );

  /// Custom URL scheme the backend redirects to after browser sign-in
  /// (must match packages/api/lib/mobile-auth.ts and the platform configs).
  static const authCallbackScheme = 'mailmonkey';

  /// Storage bucket served through the web's `/image-proxy` (web
  /// `NEXT_PUBLIC_AVATARS_BUCKET_NAME`, default `avatars`).
  static const avatarsBucket = String.fromEnvironment('AVATARS_BUCKET_NAME', defaultValue: 'avatars');

  /// Public payment product IDs (the web's `NEXT_PUBLIC_PRICE_ID_*`). Empty
  /// means checkout for that price is unavailable in this build.
  static const priceStarterMonthly = String.fromEnvironment('PRICE_ID_STARTER_MONTHLY');
  static const priceStarterYearly = String.fromEnvironment('PRICE_ID_STARTER_YEARLY');
  static const priceProMonthly = String.fromEnvironment('PRICE_ID_PRO_MONTHLY');
  static const priceProYearly = String.fromEnvironment('PRICE_ID_PRO_YEARLY');

  /// Resolves a stored avatar/photo path like the web's UserAvatar: absolute
  /// URLs pass through, storage paths go through `/image-proxy`.
  static String? imageUrl(String? pathOrUrl) {
    if (pathOrUrl == null || pathOrUrl.isEmpty) return null;
    if (pathOrUrl.startsWith('http')) return pathOrUrl;
    return '$apiBaseUrl/image-proxy/$avatarsBucket/$pathOrUrl';
  }
}
