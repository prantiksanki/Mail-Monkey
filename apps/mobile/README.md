# Mail Monkey — mobile app (Flutter)

A native Android and iOS client for Mail Monkey. It talks to the **same
backend** as the web app (`/api` on the Next.js server: oRPC REST routes,
Better Auth, and a few Hono routes). The app contains no mock data and no
duplicated business logic, and it never embeds the website in a WebView.
The only WebView is a JavaScript-disabled one that renders email bodies.

The app lives in `apps/mobile` and is independent of the pnpm/Turbo
workspace. It has no `package.json`, so `pnpm` and `turbo` ignore it.

Feature coverage against the web app is tracked in [PARITY.md](PARITY.md).

## Requirements

- Flutter 3.44+ (Dart 3.12+). Check with `flutter doctor`.
- Android: Android Studio or the command-line SDK (API 35 is installed on first build), plus an emulator or device.
- iOS: macOS with Xcode 16+ and CocoaPods. **iOS builds cannot run on Windows.**
- A running Mail Monkey backend, either local `pnpm dev` or a deployed server.

## Configuration

Everything is passed at build time with `--dart-define`. Nothing secret is
compiled into the app.

| Define | Default | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:3000` | Backend origin (the web app's URL). |
| `AVATARS_BUCKET_NAME` | `avatars` | Same as the web's `NEXT_PUBLIC_AVATARS_BUCKET_NAME`. Used to show uploaded photos through `/image-proxy`. |
| `PRICE_ID_STARTER_MONTHLY`, `PRICE_ID_STARTER_YEARLY`, `PRICE_ID_PRO_MONTHLY`, `PRICE_ID_PRO_YEARLY` | empty | Public product IDs (the web's `NEXT_PUBLIC_PRICE_ID_*`). If a price ID is empty, checkout for that price shows as unavailable. |

### Backend requirements

These already ship in the backend (commit `feat(auth): PKCE sign-in hand-off
for the native mobile app`):

- The Better Auth `bearer` plugin (`requireSignature: true`), so the app can authenticate with the signed session token instead of cookies.
- `/api/mobile-auth/{start,complete,error,exchange}`: a PKCE (S256) hand-off. The app opens Google sign-in in the system browser and receives a single-use, two-minute code at `mailmonkey://auth-callback`. It then exchanges that code, together with its PKCE verifier, for the session token.
- No new OAuth redirect URI is needed. Google still redirects to the existing `{BETTER_AUTH_URL}/api/auth/callback/google`.

## Running against the local backend

1. Start the backend from the repo root as usual (`pnpm dev`). It must listen on port 3000.
2. Android emulator: forward the port, so `localhost:3000` inside the emulator reaches your machine and the Google redirect URI (`http://localhost:3000/...`) still matches:
   ```bash
   adb reverse tcp:3000 tcp:3000
   ```
3. Run the app:
   ```bash
   cd apps/mobile
   flutter pub get
   flutter run                      # uses http://localhost:3000
   ```
   Against a deployed server:
   ```bash
   flutter run --dart-define=API_BASE_URL=https://your-domain.example
   ```

Plain-HTTP (cleartext) traffic is allowed **only in Android debug builds**
(`android/app/src/debug/AndroidManifest.xml`). On iOS it is allowed only for
local-network addresses (`NSAllowsLocalNetworking`). Release builds require
HTTPS.

> **OneDrive note (Windows):** if Flutter commands fail with "access denied"
> on `ios/Flutter/ephemeral`, delete that folder and retry. OneDrive locks it.

## Building

```bash
flutter build apk --debug                      # Android debug APK
flutter build apk --release --dart-define=API_BASE_URL=https://…   # needs a signing config
flutter build ios --release --dart-define=API_BASE_URL=https://…   # macOS only
```

Release builds still need app signing set up: an Android keystore plus a
`signingConfig`, and an iOS team or provisioning profile. Neither is
included.

## Quality checks

```bash
flutter analyze   # strict analysis (see analysis_options.yaml)
flutter test      # unit and widget tests
```

From the repo root, `biome ci .` also lints the app's JSON files (for
example the Xcode asset catalogs).

## Architecture

```
lib/
  core/       config (Env), ApiClient (dio + bearer + SSE), error mapping,
              PKCE, secure token storage, routing (go_router), theme
  models/     typed JSON models for API responses
  services/   one class per backend module (mail, rules, insights, AI,
              bills, account/integrations/billing/admin, creator)
  features/   screens + Riverpod state, grouped by product area
  shared/     drawer, charts, state views, formatting
```

- **State:** Riverpod 3. Screens watch `FutureProvider`s or notifiers. Mutations are optimistic where the web's are, with rollback on failure.
- **Auth:** the session token is kept in the platform keystore (`flutter_secure_storage`). Any 401 clears it and returns the user to sign-in. Authorization is always enforced by the server; hiding a menu item in the app (admin, creator) is never the protection.
- **Signed uploads** (avatars, My Page photos) go straight to the storage URL with a separate HTTP client, so the session token never leaves the API origin.
- **Streaming:** the AI assistants use the backend's SSE stream of AI SDK UI-message chunks (`lib/models/ai_chat.dart`). Tool approvals and client-side tool results resubmit the same turn, as `useChat` does on the web.
