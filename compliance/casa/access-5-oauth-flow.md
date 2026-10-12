# CASA AL0/AL1 — Access 5 (3.2.1 - AL1.1)

> **Requirement:** If the application uses an OAuth 2.0 integration, provide a written description along with relevant evidence (screenshots, source code, or other documentation) detailing which OAuth 2.0 flow is used.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access Control**, row 6 (cell `D6`).

---

## Answer

**Yes — zeromail-app uses OAuth 2.0, and every integration uses the Authorization Code flow with PKCE.** No implicit flow, no resource owner password credentials grant, and no client-side token handling is used anywhere in the application.

The implementation is **better-auth 1.4.7** ([`packages/auth/auth.ts`](../../packages/auth/auth.ts), `packages/auth/package.json`). The application does not hand-roll any part of the OAuth exchange; better-auth owns authorization-URL construction, `state` generation and validation, PKCE, the code-for-token exchange, and token persistence.

---

## 1. Which flow, and why it is the right one

| Property | Value |
| --- | --- |
| Grant type | Authorization Code |
| PKCE | Yes — `code_verifier` (128-char random) + `code_challenge` |
| Client type | **Confidential** — Next.js server-side; client secrets never reach the browser |
| Token exchange | Server-to-server, back channel |
| Token storage | PostgreSQL `account` table, server-side only |
| Refresh tokens | Requested where the integration needs background access |

The application is a server-rendered Next.js app that can hold a client secret, so a confidential-client Authorization Code flow is the correct choice. PKCE is applied on top as defence in depth against authorization-code interception. Tokens are never exposed to browser JavaScript — the browser only ever holds the application's own signed, HTTP-only session cookie.

---

## 2. The integrations

### 2a. Sign-in + mailbox providers (`socialProviders`)

These serve double duty: they authenticate the user *and* provision the mailbox the product operates on.

**Google** — scopes `email`, `profile`, `gmail.modify`, `gmail.send`, `calendar.readonly`, `calendar.events`; `accessType: "offline"` and `prompt: "consent"` so a refresh token is reliably issued.

**Microsoft** — scopes `openid`, `profile`, `email`, `offline_access`, `User.Read`, `Mail.ReadWrite`, `Mail.Send`; tenant from `MICROSOFT_TENANT_ID`, defaulting to `common`.

### 2b. Optional service integrations (`genericOAuth`)

Zoom, Zoho Meeting, and HubSpot are registered **only when their client credentials are present in the environment**, so an environment without them carries no such provider at all:

```ts
if (zoomClientId && zoomClientSecret) { genericOAuthConfigs.push({ ... }); }
```

| Provider | Authorization endpoint | Token endpoint | Client auth |
| --- | --- | --- | --- |
| Zoom | `https://zoom.us/oauth/authorize` | `https://zoom.us/oauth/token` | HTTP Basic |
| Zoho Meeting | `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/auth` | `${ZOHO_ACCOUNTS_DOMAIN}/oauth/v2/token` | POST body |
| HubSpot | `https://app.hubspot.com/oauth/authorize` | `https://api.hubapi.com/oauth/v1/token` | POST body |

All three are Authorization Code flows. Zoho additionally sets `accessType: "offline"` and `prompt: "consent"` because it only issues a refresh token when both are present — without them the connection would silently break at first token expiry.

Each declares an explicit, absolute `redirectURI` derived from the application's own base URL — see [Access 6](./access-6-oauth-state-redirect-uri.md).

---

## 3. Source-code evidence for PKCE and the code exchange

PKCE parameters are generated per authorization request in better-auth's OAuth2 state module (`packages/auth/node_modules/better-auth/dist/oauth2/state.mjs`):

```js
async function generateState(c, link, additionalData) {
  const callbackURL = c.body?.callbackURL || c.context.options.baseURL;
  if (!callbackURL) throw new APIError("BAD_REQUEST", { message: "callbackURL is required" });
  const codeVerifier = generateRandomString(128);
  const state = generateRandomString(32);
  ...
}
```

The `codeVerifier` is stored server-side alongside the `state` (in the `verification` table, or in an encrypted cookie under the cookie strategy) and replayed on the token request; `code_challenge_method` appears in the authorization-URL construction. Both `state` and `codeVerifier` are cryptographically random and single-use.

---

## 4. Identity is verified, not assumed

A distinguishing control worth noting for this requirement: the application does not trust profile data returned alongside the token.

**Google ID tokens are cryptographically verified** before the mailbox is provisioned ([`packages/auth/auth.ts`](../../packages/auth/auth.ts)):

```ts
const { payload: verifiedPayload } = await jwtVerify(account.idToken, GOOGLE_JWKS, {
  issuer: "https://accounts.google.com",
  audience: process.env.GOOGLE_CLIENT_ID,
  algorithms: ["RS256"],
});
```

Signature is checked against Google's live JWKS, the issuer is pinned, the audience is pinned to the application's own client ID, and the algorithm is pinned to `RS256` — closing algorithm-confusion and token-substitution attacks. A token that fails any of these throws, is logged as `"Invalid or forged Google idToken"`, and no mailbox is created. The `email_verified` claim is inspected and a warning logged when false.

**Microsoft** identity is fetched from Graph `/me` using the freshly issued access token. **HubSpot** identity comes from access-token introspection (`/oauth/v1/access-tokens/{token}`), since HubSpot exposes no OIDC userinfo endpoint. **Zoho** identity comes from `/oauth/user/info`, and the handler rejects the profile unless both `ZUID` and `Email` are present.

In each case identity is derived from a provider-authenticated call, never from an unverified client-supplied value.

---

## 5. Token handling

- Tokens are persisted in the `account` table (PostgreSQL) and read only by server-side code.
- Access tokens are refreshed server-side; `offline_access` / `accessType: "offline"` ensure refresh tokens are available where background sync requires them.
- Outbound provider calls always use the token belonging to the ownership-verified mailbox, scoped to `userId: "me"` (Gmail) or `/me/...` (Graph).
- Disconnect endpoints (`POST /api/{zoom,zoho,hubspot}/disconnect`) delete the stored account row for that user and provider, revoking the application's stored grant.
- `advanced.useSecureCookies` is enabled in production; session cookies are HTTP-only and signed.
