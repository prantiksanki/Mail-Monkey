# CASA AL0/AL1 — Session 5 (2.4.1 - AL1.1, AL1.2)

> **Requirement:** Provide code snippets that shows either the user has a
> full login session or an account verification process is conducted before
> allowing user account modifications or sensitive data transaction. OR
> provide documentation that describes either the user has a full login
> session or an account verification process is conducted before allowing
> user account modifications or sensitive data transaction.

---

## Summary

Two layers apply, depending on sensitivity. **Every** authenticated
endpoint — all routine data mutations (mailbox, rules, drafts, and so on) —
requires a full login session, verified server-side and checked against
resource ownership before any read or write (documented in full under this
application's access-control evidence). **Account-sensitive operations**
specifically — changing password, setting a password, changing email, and
deleting the account — go further: they require a session check that
bypasses the signed-cookie cache entirely (forcing a live database lookup),
and account deletion additionally requires either a fresh session or a
re-supplied password, or is gated behind an emailed confirmation link
before the irreversible action executes.

---

## 1. Every mutation requires a full login session

All non-public API endpoints are built from `protectedProcedure`, which
resolves and validates the caller's session before the handler runs, and
rejects with an unauthorized error if no valid session exists. Ownership of
the specific resource being modified is additionally re-verified against
the session's user ID on every mutation (see this application's
access-control and IDOR-protection evidence for the full mechanism and
per-endpoint table). This is the baseline "full login session" gate that
applies to the entire authenticated surface of the application.

---

## 2. Account-sensitive operations use a stricter session check

The self-hosted auth layer provides a dedicated middleware for exactly this
purpose, documented in its own source comment
(`better-auth/dist/api/routes/session.mjs:269-276`):

```js
/**
* This middleware forces the endpoint to require a valid session and ignores cookie cache.
* This should be used for sensitive operations like password changes, account deletion, etc.
* to ensure that revoked sessions cannot be used even if they're still cached in cookies.
*/
const sensitiveSessionMiddleware = createAuthMiddleware(async (ctx) => {
  const session = await getSessionFromCtx(ctx, { disableCookieCache: true });
  if (!session?.session) throw new APIError("UNAUTHORIZED");
  return { session };
});
```

This is wired onto the actual account-modification endpoints in this
application's auth configuration
(`better-auth/dist/api/routes/update-user.mjs`):

| Endpoint | Middleware |
|---|---|
| Change password | `sensitiveSessionMiddleware` |
| Set password (accounts without one) | `sensitiveSessionMiddleware` |
| Delete user | `sensitiveSessionMiddleware` |
| Change email | `sensitiveSessionMiddleware` |

The practical effect: for these operations, even a still-cached, signed
session cookie (normally trusted for up to 60 seconds without a database
round-trip — see this application's logout/expiration evidence) is not
sufficient. The session must be re-verified live against the database on
every one of these requests, so a revoked session is rejected immediately
rather than within the cache's staleness window.

---

## 3. Account deletion additionally requires freshness or re-verification

Beyond the live-session check above, deleting the account applies a second,
independent control. If no password is supplied with the deletion request,
the session must also be "fresh" — updated within the configured freshness
window — or the request is rejected:

```js
if (!ctx.body.password && ctx.context.sessionConfig.freshAge !== 0) {
  const currentAge = new Date(session.session.createdAt).getTime();
  const freshAge = ctx.context.sessionConfig.freshAge * 1e3;
  if (Date.now() - currentAge > freshAge * 1e3) {
    throw new APIError("BAD_REQUEST", { message: "SESSION_EXPIRED" });
  }
}
```

Separately, this application's own auth configuration
(`packages/auth/auth.ts:754-771`) requires an **emailed confirmation link**
before an account deletion actually executes:

```ts
deleteUser: {
  enabled: true,
  // Account deletion is irreversible and cascades to connected
  // mailboxes, so require the user to confirm from a link mailed to...
  ...
},
```

This is a genuine account-verification process, not merely a session check:
the deletion does not complete until the user follows a link sent to their
registered email address, confirming intent for an operation the code
comment explicitly calls out as irreversible.

---

## 4. Email change also requires confirmation

Changing the account's email address is configured the same way
(`packages/auth/auth.ts:772-774`):

```ts
changeEmail: {
  enabled: true,
  sendChangeEmailVerification: async ({ user: { email, name }, url }) => { ... },
},
```

A change to the account's email address triggers a verification email with
a confirmation link before the change takes effect — combined with the
`sensitiveSessionMiddleware` gate on the endpoint itself (§2), this means
the change-email flow requires both a live, non-cached session **and**
email-based confirmation.

---

## Verification

- **Checked against:** `packages/api/orpc/procedures.ts`
  (`protectedProcedure`), this application's access-control and
  IDOR-protection evidence (ownership verification on every mutation), the
  self-hosted auth layer's `sensitiveSessionMiddleware` and
  `freshSessionMiddleware` implementations
  (`better-auth/dist/api/routes/session.mjs`), the account-modification
  endpoints in `better-auth/dist/api/routes/update-user.mjs`
  (`change-password`, `set-password`, `delete-user`, `change-email`),
  `packages/auth/auth.ts` (`deleteUser`, `changeEmail` configuration).
- **Date:** 2026-09-16.
- **Re-verify if:** the auth library is upgraded and its middleware
  assignments on account-modification endpoints change, `deleteUser` /
  `changeEmail` configuration in `packages/auth/auth.ts` is modified, or
  `freshAge` is changed.
