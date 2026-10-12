# CASA AL0/AL1 — Session 1 (2.2.1 - AL1.1, AL1.2)

> **Requirement:** Provide code snippets that show how the logout and
> expiration functionality is implemented and that demonstrate user session
> tokens are invalidated when a user logs out or the session is expired. OR
> provide documentation that describes how session tokens are handled on
> user logout and expiration.

---

## Summary

Session tokens are fully server-side and database-backed (self-hosted auth
layer, PostgreSQL). On logout, the session row is deleted from the database
and both session cookies are cleared via the response — not just a
client-side cookie removal. On every authenticated request, the session's
expiry is checked against the database record; an expired session is
rejected and its row is pruned at that point. Sessions default to a 30-day
lifetime with a 60-second signed-cookie read cache to avoid hitting the
database on every request; sensitive routes bypass that cache entirely.
Additional revocation paths exist for password change, password reset, and
a self-service "sign out of other devices" control.

---

## 1. Session configuration

`packages/auth/auth.ts:552-567`:

```ts
session: {
  expiresIn: config.sessionCookieMaxAge,   // 30 days
  // Require a recently-authenticated session for operations gated on
  // freshness (e.g. unlinking a social account). 24h matches the library default.
  freshAge: 60 * 60 * 24,
  // Serves session reads from a signed cookie instead of hitting the DB on
  // every request. Revoked sessions / role changes propagate within maxAge;
  // 60s keeps that window short (sensitive routes bypass the cache
  // entirely via Better Auth's sensitiveSessionMiddleware).
  cookieCache: {
    enabled: true,
    maxAge: 60,
  },
},
advanced: {
  useSecureCookies: process.env.NODE_ENV === "production",
  ...
},
```

`config.sessionCookieMaxAge` (`packages/auth/config.ts:22`) is
`60 * 60 * 24 * 30` = **30 days**. The 60-second `cookieCache.maxAge` bounds
how stale a cached session read can be — a revoked session is rejected by
the database check (§3) within, at most, this window on cache-eligible
routes, and immediately on any route that bypasses the cache.

Session cookies are `httpOnly`, `sameSite: "lax"`, and `secure` when
`useSecureCookies` is true (enforced in production), and the token itself is
HMAC-signed with the server secret — set by the auth library's own cookie
layer, not reimplemented in this codebase.

---

## 2. Logout — server-side session deletion, not just a cookie clear

**Client** (`apps/web/modules/saas/shared/components/UserMenu.tsx`):

```ts
await authClient.signOut({
  fetchOptions: {
    onSuccess: () => {
      clearClientStateOnLogout();
      // hard navigation away from the app
    },
  },
});
```

**Server** — the auth library's sign-out route
(`better-auth/dist/api/routes/sign-out.mjs`):

```js
async (ctx) => {
  const sessionCookieToken = await ctx.getSignedCookie(...);
  if (sessionCookieToken) {
    await ctx.context.internalAdapter.deleteSession(sessionCookieToken);
  }
  deleteSessionCookie(ctx);
  return ctx.json({ success: true });
}
```

`deleteSession` removes the corresponding row from the `Session` table in
PostgreSQL. `deleteSessionCookie` then clears both the session-token cookie
and the session-data (cache) cookie via a `Set-Cookie` response with
`maxAge: 0`. **This is genuine server-side invalidation**: even if a copy of
the old session cookie were replayed after logout, the database lookup in
§3 would find no matching row and reject the request.

---

## 3. Expiration enforcement — checked on every request, pruned lazily

Every non-public API procedure resolves the caller's session through the
same path (`packages/api/orpc/procedures.ts:9-38`):

```ts
export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return await next({ context: { session: session.session, user: session.user } });
});
```

The auth library's session route (`better-auth/dist/api/routes/session.mjs`)
performs the actual expiry check:

```js
const session = await ctx.context.internalAdapter.findSession(sessionCookieToken);
if (!session || session.session.expiresAt < new Date()) {
  deleteSessionCookie(ctx);
  if (session) await ctx.context.internalAdapter.deleteSession(session.session.token);
  return ctx.json(null);
}
```

An expired session returns `null` from `getSession`, which
`protectedProcedure` turns into `UNAUTHORIZED` — the request is rejected. The
already-expired database row is deleted at that same moment (lazy pruning
on access, not a scheduled job). A separate rolling-expiry refresh extends a
still-valid session's `expiresAt` and reissues its cookie once the session
nears its `updateAge` window, so an actively used session does not expire
mid-use.

---

## 4. Other session-revocation paths

| Trigger | Mechanism |
|---|---|
| User changes their password | `authClient.changePassword({ revokeOtherSessions: true })` (`apps/web/modules/saas/settings/components/ChangePassword.tsx`) — deletes every other session row for the account |
| User completes a password reset | `revokeSessionsOnPasswordReset: true` (`packages/auth/auth.ts:802`) — same effect, triggered from the unauthenticated reset flow |
| User revokes a specific device/session | `authClient.listSessions()` / `authClient.revokeSession({ token })` (`apps/web/modules/saas/settings/components/ActiveSessionsBlock.tsx`) — self-service "active sessions" panel; deletes the targeted `Session` row after verifying it belongs to the caller |

The auth library's `/revoke-session` and `revoke-other-sessions` routes
(`better-auth/dist/api/routes/session.mjs`) implement these as direct
database deletions, the same underlying mechanism as logout in §2 — there is
one invalidation primitive (delete the `Session` row), triggered from
several places.

---

## 5. Database evidence

`packages/database/prisma/schema.prisma:243-262` — the `Session` model:

```prisma
model Session {
  id        String   @id
  token     String   @unique
  userId    String
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  ...
}
```

`expiresAt` is a required, non-nullable field — every session row carries an
expiry from creation. There is no background cleanup job for expired
sessions in this repository; pruning is lazy, happening only when a session
is looked up (§3) or listed (`listSessions` filters to
`expiresAt > new Date()`). This means an expired-but-unqueried row can
persist in the table, but it is never treated as valid — every code path
that reads a session re-checks `expiresAt` before trusting it.

---

## Verification

- **Checked against:** `packages/auth/auth.ts` (session config, lines
  545-567), `packages/auth/config.ts` (`sessionCookieMaxAge`),
  `packages/api/orpc/procedures.ts` (`protectedProcedure`), the auth
  library's `sign-out.mjs` and `session.mjs` route implementations,
  `apps/web/modules/saas/settings/components/ChangePassword.tsx`,
  `apps/web/modules/saas/settings/components/ActiveSessionsBlock.tsx`,
  `packages/database/prisma/schema.prisma` (`Session` model).
- **Date:** 2026-09-16.
- **Re-verify if:** `session.expiresIn` / `cookieCache.maxAge` change in
  `packages/auth/auth.ts`, the auth library is upgraded and its sign-out or
  session-validation logic changes, or a background session-cleanup job is
  introduced.
