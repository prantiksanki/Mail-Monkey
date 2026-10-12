# CASA AL0/AL1 — Session 4 (2.3.3 - AL1.1)

> **Requirement:** Provide code snippets of session token creation; showing
> dynamically generated tokens.

---

## Summary

A new session token is generated on every session creation — sign-in, and
the reissue that happens after a password change (see
[Session 2](./session-2-password-change-invalidation.md)) — via the
self-hosted auth layer's `createSession` internal adapter method. The token
itself is produced by `generateId(32)`, a 32-character string drawn from a
62-character alphabet (`a-z`, `A-Z`, `0-9`) using a cryptographically secure
random generator with rejection sampling — the same generator already
documented and verified for other tokens (email verification, password
reset) under controls 1.1.2 and 1.3.x. No token is ever reused, hardcoded,
or derived from predictable input; each call produces a fresh, independent
32-character value.

---

## 1. Token creation — `internalAdapter.createSession`

`better-auth/dist/db/internal-adapter.mjs:132-148`:

```js
createSession: async (userId, dontRememberMe, override, overrideAll) => {
  const ctx$1 = await getCurrentAuthContext().catch(() => null);
  const headers = ctx$1?.headers || ctx$1?.request?.headers;
  const { id: _, ...rest } = override || {};
  const defaultAdditionalFields = parseSessionInput(ctx$1?.context.options ?? options, {});
  const data = {
    ipAddress: ctx$1?.request || ctx$1?.headers
      ? getIp(ctx$1?.request || ctx$1?.headers, ctx$1?.context.options) || ""
      : "",
    userAgent: headers?.get("user-agent") || "",
    ...rest,
    expiresAt: dontRememberMe
      ? getDate(3600 * 24, "sec")
      : getDate(sessionExpiration, "sec"),
    userId,
    token: generateId(32),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...defaultAdditionalFields,
    ...overrideAll ? rest : {},
  };
  return await createWithHooks(data, "session", ...);
}
```

The token is created fresh (`token: generateId(32)`) as part of building the
new session record on every call to `createSession` — this function is
invoked on sign-in, and again whenever a session needs to be reissued (for
example the `revokeOtherSessions` flow documented under
[Session 2](./session-2-password-change-invalidation.md), which deletes all
existing sessions and then calls `createSession` to mint a replacement).
Each invocation independently generates a new token — nothing is cached,
reused across calls, or derived from a prior token.

A secondary detail surfaced by this trace: the `dontRememberMe` parameter
independently governs the new session's expiry — a shorter 24-hour expiry
when the user opts out of "remember me," versus the standard
`sessionExpiration` (30 days, per [Session 1](./session-1-logout-expiration.md))
otherwise. Both branches still generate the token identically; only the
`expiresAt` value differs.

---

## 2. Token generation algorithm — `generateId`

Traced to its actual implementation in `@better-auth/core/src/utils/id.ts`:

```ts
import { createRandomStringGenerator } from "@better-auth/utils/random";

export const generateId = (size?: number) => {
  return createRandomStringGenerator("a-z", "A-Z", "0-9")(size || 32);
};
```

`createRandomStringGenerator` is the **same** generator already documented
and verified under controls 1.1.2 and 1.3.x for the password-reset token
(`generateId(24)`) and other verifiers:

1. Builds the target character set — here `a-z`, `A-Z`, `0-9`, a
   62-character alphabet.
2. Computes the largest multiple of the alphabet size that fits in one
   byte, to avoid modulo bias.
3. Fills a byte buffer using `crypto.getRandomValues` — a cryptographically
   secure random source backed by the operating system's entropy.
4. For each byte, appends the corresponding character if it falls within
   the unbiased range, otherwise discards it and continues (rejection
   sampling) until the requested length is reached.

A 32-character token over a 62-character alphabet carries approximately
**190 bits of entropy** — well beyond what is guessable or brute-forceable,
and larger than the 24-character (~143-bit) password-reset token, since
session tokens are long-lived (up to 30 days) and therefore warrant a wider
margin.

---

## 3. Why "dynamically generated" is accurate here

Every property the requirement is checking for is satisfied by this single
code path:

- **Freshly generated per session** — `generateId(32)` is called anew
  inside every `createSession` invocation; there is no static, shared, or
  precomputed token value anywhere in the codebase.
- **Cryptographically random** — backed by `crypto.getRandomValues`, not a
  predictable source (timestamp, counter, sequential ID).
- **Unbiased** — rejection sampling ensures uniform distribution across the
  character set.
- **High entropy** — 32 characters over 62 possible values per character
  makes brute-forcing or guessing a valid token computationally infeasible.

---

## Verification

- **Checked against:** the self-hosted auth layer's
  `internalAdapter.createSession` implementation
  (`better-auth@1.4.22/dist/db/internal-adapter.mjs`), the `generateId`
  implementation (`@better-auth/core@1.4.22/src/utils/id.ts`), and the
  session-expiry configuration already documented under
  [Session 1](./session-1-logout-expiration.md).
- **Date:** 2026-09-16.
- **Re-verify if:** the auth library is upgraded and its session-token
  generation changes (algorithm, size, or source library), or a custom
  token generator is ever configured in `packages/auth/auth.ts`.
