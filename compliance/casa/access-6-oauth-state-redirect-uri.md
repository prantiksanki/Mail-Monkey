# CASA AL0/AL1 — Access 6 (3.2.2 - AL1.1)

> **Requirement:** If the application uses an OAuth 2.0 integration, provide a written description along with relevant evidence (screenshots, source code, or other documentation) detailing how the application uses the state and redirect_uri parameters to prevent common OAuth vulnerabilities.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access Control**, row 7 (cell `D7`).

Companion document: [Access 5 — OAuth 2.0 flow](./access-5-oauth-flow.md).

---

## Summary

`state` and `redirect_uri` are both handled by **better-auth 1.4.7**; the application does not implement either itself. `state` is a 128-bit random, single-use, server-persisted value bound to a signed cookie and validated on callback. `redirect_uri` values are fixed, absolute, and derived from the application's own base URL, and any post-login `callbackURL` is validated against an allowlist of trusted origins.

---

## 1. `state` — CSRF and session-fixation protection

### Generation

Per authorization request (`packages/auth/node_modules/better-auth/dist/oauth2/state.mjs`):

```js
const codeVerifier = generateRandomString(128);
const state = generateRandomString(32);
const stateData = {
  callbackURL, codeVerifier,
  errorURL: c.body?.errorCallbackURL,
  newUserURL: c.body?.newUserCallbackURL,
  link,
  expiresAt: Date.now() + 600 * 1e3,
  requestSignUp: c.body?.requestSignUp,
  state,
};
```

The `state` is a 32-character cryptographically random string. It is **not** a bare opaque nonce echoed back — it is the key to a server-side record holding the PKCE `code_verifier`, the intended `callbackURL`, and an absolute expiry.

### Storage — bound to the browser session, two ways

Under the default strategy, the state record is written to the `verification` table with a 10-minute expiry, **and** the `state` value is additionally written to a **signed cookie** using the server secret:

```js
const stateCookie = c.context.createAuthCookie("state", { maxAge: 300 * 1e3 });
await c.setSignedCookie(stateCookie.name, state, c.context.secret, stateCookie.attributes);
const verification = await c.context.internalAdapter.createVerificationValue({
  value: JSON.stringify(stateData), identifier: state, expiresAt,
});
```

Under the cookie strategy the whole state payload is instead stored in a cookie encrypted with `symmetricEncrypt` under the server secret.

This dual binding is what defeats **login CSRF**: an attacker who obtains or forges a `state` value still cannot produce the matching signed cookie in the victim's browser, because it is signed with a secret they do not hold.

### Validation on callback

```js
const data = await c.context.internalAdapter.findVerificationValue(state);
if (!data) {
  c.context.logger.error("State Mismatch. Verification not found", { state });
  throw c.redirect(`${errorURL}?error=please_restart_the_process`);
}
parsedData = stateDataSchema.parse(JSON.parse(data.value));
const stateCookieValue = await c.getSignedCookie(stateCookie.name, c.context.secret);
if (!skipStateCookieCheck && (!stateCookieValue || stateCookieValue !== state)) {
  throw c.redirect(`${errorURL}?error=state_mismatch`);
}
```

Four independent checks must all pass:

1. **Presence** — a callback with no matching server-side record is rejected (`please_restart_the_process`).
2. **Cookie binding** — the signed cookie must be present and must equal the returned `state`, otherwise `state_mismatch`.
3. **Schema** — the stored payload is parsed against a Zod schema before use.
4. **Expiry** — `if (parsedData.expiresAt < Date.now())` rejects a replayed or stale authorization.

### Single use

The state record is destroyed as soon as it is consumed, and the cookie is cleared:

```js
c.setCookie(stateCookie.name, "", { maxAge: 0 });
await c.context.internalAdapter.deleteVerificationValue(data.id);
```

A captured authorization response therefore cannot be replayed — the second attempt finds no verification record.

### Deployment note

better-auth exposes a `skipStateCookieCheck` option, which its own source comments describe as a security issue intended only for development or staging (it exists for the `oauth-proxy` plugin). **zeromail-app does not enable it** — it appears nowhere in [`packages/auth/auth.ts`](../../packages/auth/auth.ts) and no `oauthConfig` override is set, so the cookie-binding check is always active.

### Related: PKCE

The same record carries a 128-character `code_verifier`, replayed on the token request. Even if an authorization code were intercepted, it cannot be exchanged without the verifier held server-side — closing authorization-code interception independently of `state`.

---

## 2. `redirect_uri` — open redirect and code-leakage protection

### Fixed, absolute, server-derived

Every provider declares an explicit redirect URI built from the application's own base URL ([`packages/auth/auth.ts`](../../packages/auth/auth.ts)):

```ts
const appUrl = getBaseUrl();
// ...
redirectURI: `${appUrl}/api/auth/oauth2/callback/zoom`,
redirectURI: `${appUrl}/api/auth/oauth2/callback/zoho`,
redirectURI: `${appUrl}/api/auth/oauth2/callback/hubspot`,
```

These are **never** assembled from request data — not from the `Host` header, not from a query parameter. A Host-header injection or a crafted `redirect_uri` parameter cannot redirect the authorization code to an attacker-controlled origin.

### Provider-side allowlisting

Because each redirect URI is a fixed absolute string, it is registered verbatim in the Google Cloud console, Microsoft Entra app registration, and the Zoom / Zoho / HubSpot app configurations. The identity provider performs exact-match validation and rejects any authorization request presenting a different value — an independent enforcement point outside the application's own trust boundary.

### Post-login `callbackURL` is allowlisted

The application-level redirect target (where the user lands *after* authentication) is separate from the OAuth `redirect_uri`, and is the parameter an open-redirect attack would realistically target. It is validated against `trustedOrigins`:

```ts
export const auth = betterAuth({
  baseURL: appUrl,
  trustedOrigins: [appUrl, ...extraTrustedOrigins],
  ...
});
```

better-auth's origin-check middleware (`dist/api/middlewares/origin-check.mjs`) rejects any URL failing `ctx.context.isTrustedOrigin(url, ...)`, logging guidance to add it to `trustedOrigins` if legitimate. The allowlist is the application's own base URL, extensible only through the `BETTER_AUTH_TRUSTED_ORIGINS` environment variable — a deployment-time control for development tunnels such as ngrok, not a user-supplied value.

The `callbackURL` is additionally stored *inside the signed/encrypted state payload* at authorization time rather than being read from the callback request, so it cannot be swapped between the authorization request and the callback.

### Transport

`advanced.useSecureCookies` is enabled in production, so state and session cookies carry the `Secure` attribute and are never transmitted over plaintext HTTP.

---

## 3. Vulnerabilities addressed

| Attack | Control |
| --- | --- |
| Login CSRF / forced sign-in | Random `state` bound to a signed, secret-keyed cookie; mismatch rejected |
| Authorization response replay | Single-use state record deleted on consumption; 10-minute expiry |
| Authorization code interception | PKCE `code_verifier` (128 chars) held server-side |
| Open redirect | Fixed server-derived `redirect_uri`; post-login `callbackURL` allowlisted against `trustedOrigins` |
| Code exfiltration via redirect tampering | Redirect URIs never built from request data; exact-match validated provider-side |
| Token substitution / algorithm confusion | Google ID token verified against JWKS with pinned issuer, audience, and `RS256` (see [Access 5](./access-5-oauth-flow.md)) |
| Mix-up between providers | Each provider has a distinct callback path; the state record binds the flow to the provider that issued it |
