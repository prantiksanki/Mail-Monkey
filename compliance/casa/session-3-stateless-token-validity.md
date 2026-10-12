# CASA AL0/AL1 — Session 3 (2.2.3 - AL1.1)

> **Requirement:** Provide code snippets, screenshot, or documentation that
> shows the time period for which stateless tokens are valid (if utilized).

---

## Answer: Not applicable — the application does not use stateless tokens for session/authentication

Session/authentication tokens in this application are **opaque and
database-backed**, not stateless. A server-side lookup against the
`Session` table (with an `expiresAt` comparison) is required to validate
every session — see [Session 1](./session-1-logout-expiration.md) for the
full mechanism. There is no self-contained, signed token (e.g. a JWT) that
a server can validate offline without a database round-trip, so there is no
stateless-token validity period to report for session/authentication
purposes.

This is confirmed by direct inspection, not merely an absence of evidence:

- No `jwt()` or `bearer()` plugin is registered anywhere in
  `packages/auth/auth.ts`. A repository-wide search across `packages/auth`
  for stateless-token indicators (`jwt(`, `bearer(`, `jwks`, an
  `expirationTime` / JWT-expiry configuration option) returns nothing
  related to session issuance.
- The only JWT-related code present is `createRemoteJWKSet` / `jwtVerify`
  from the `jose` library (`packages/auth/auth.ts:32`), used exclusively to
  **verify an inbound, Google-issued ID token** during OAuth sign-in
  (`auth.ts:255-256`, `:384-390`) — this validates a token Google created,
  it is not a stateless token this application issues to authenticate its
  own users on subsequent requests.

---

## Two things that are adjacent to, but distinct from, a stateless session token

### 1. Email verification link (HS256 JWT) — a one-time action link, not a session token

The application does issue one genuinely stateless, self-verifying JWT: the
email-verification link, fully documented under control 1.1.2. It is an
HS256 JWT signed with the server secret, carrying a 1-hour `exp` claim, and
is verifiable offline (signature + expiry check, no database lookup
required to confirm authenticity). However, this token proves control of an
email address **once**, at sign-up; it is never presented as a bearer
credential on ordinary application requests, and possessing it does not
grant an authenticated session. It is out of scope for "session validity"
as this control is asking about it, though it is the closest thing in this
codebase to a stateless, time-bound token and is cross-referenced here for
completeness.

### 2. `CRON_SECRET` — a static bearer credential, not a time-bound token

Internal cron endpoints (`packages/api/index.ts:79-87` and ~7 routes under
`/internal/cron/*`) are authorized via
`Authorization: Bearer ${CRON_SECRET}`:

```ts
// Authorize internal/cron endpoints via `Authorization: Bearer ${CRON_SECRET}`.
// When CRON_SECRET is unset (local dev), the check is a no-op.
function isInternalRequestAuthorized(c) {
  const cronSecret = process.env.CRON_SECRET;
  return !cronSecret || c.req.header("authorization") === `Bearer ${cronSecret}`;
}
```

This is a **static, non-expiring shared secret**, rotated manually via
environment configuration — it is not a time-bound, self-contained token
with a validity period in the sense this control asks about. It is also not
a user-session credential at all: it authorizes machine-to-machine cron
requests, never a human user, and carries no user identity or claims of its
own.

---

## Verification

- **Checked against:** `packages/auth/auth.ts` (repository-wide search for
  `jwt(`, `bearer(`, `jwks`, JWT-expiry configuration — no session-issuance
  match found), `packages/api/index.ts` (`CRON_SECRET` authorization
  check), the email-verification JWT documented under control 1.1.2.
- **Date:** 2026-09-16.
- **Re-verify if:** a `jwt()` or `bearer()` plugin is ever registered in
  `packages/auth/auth.ts` for session issuance, or the application begins
  issuing any other stateless, self-contained token as a session or
  authentication credential.
