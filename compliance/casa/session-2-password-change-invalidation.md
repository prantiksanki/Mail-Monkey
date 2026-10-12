# CASA AL0/AL1 — Session 2 (2.2.2 - AL1.1, AL1.2)

> **Requirement:** Provide code snippets that show how session invalidation
> is handled for a user after a successful password change. OR provide
> documentation that describes how session invalidation is handled for a
> user after a successful password change.

---

## Summary

On a successful password change, the application requests that the
self-hosted auth layer revoke sessions with `revokeOtherSessions: true`.
Server-side, this **deletes every session row for the account** — including
the one that performed the change — verifies the current (soon-to-be-old)
password before doing so, then immediately issues a **brand-new session**
and sets its cookie on the response. The practical effect is exactly what
the requirement asks for: every session that existed before the password
change (on any device, including the one making the change) is invalidated,
and the user is left signed in only via a freshly issued session created
after the change succeeded.

---

## 1. Client — requesting revocation on password change

`apps/web/modules/saas/settings/components/ChangePassword.tsx:21-59`:

```ts
const formSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export function ChangePasswordForm() {
  ...
  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await authClient.changePassword({
      ...values,
      revokeOtherSessions: true,
    });

    if (error) {
      toast.error(t("settings.account.security.changePassword.notifications.error"));
      return;
    }

    toast.success(t("settings.account.security.changePassword.notifications.success"));
    form.reset({});
    router.refresh();
  });
  ...
}
```

The form requires the user's current password (minimum 1 character — i.e.
non-empty, verified server-side) alongside the new password (minimum 8
characters), and always passes `revokeOtherSessions: true` on every
password-change submission — this is not optional or conditional in this
application's UI.

---

## 2. Server — verify, update, revoke, reissue

The self-hosted auth layer's `/change-password` endpoint
(`better-auth/dist/api/routes/update-user.mjs`):

```js
const changePassword = createAuthEndpoint("/change-password", {
  method: "POST",
  body: z.object({
    newPassword: z.string(),
    currentPassword: z.string(),
    revokeOtherSessions: z.boolean().optional(),
  }),
  use: [sensitiveSessionMiddleware],
  ...
}, async (ctx) => {
  const { newPassword, currentPassword, revokeOtherSessions } = ctx.body;
  const session = ctx.context.session;

  // length checks on newPassword omitted for brevity

  const account = (await ctx.context.internalAdapter.findAccounts(session.user.id))
    .find((a) => a.providerId === "credential" && a.password);
  if (!account || !account.password) {
    throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND });
  }

  const passwordHash = await ctx.context.password.hash(newPassword);

  if (!await ctx.context.password.verify({ hash: account.password, password: currentPassword })) {
    throw new APIError("BAD_REQUEST", { message: BASE_ERROR_CODES.INVALID_PASSWORD });
  }

  await ctx.context.internalAdapter.updateAccount(account.id, { password: passwordHash });

  let token = null;
  if (revokeOtherSessions) {
    await ctx.context.internalAdapter.deleteSessions(session.user.id);
    const newSession = await ctx.context.internalAdapter.createSession(session.user.id);
    if (!newSession) throw new APIError("INTERNAL_SERVER_ERROR", { ... });
    await setSessionCookie(ctx, { session: newSession, user: session.user });
    token = newSession.token;
  }

  return ctx.json({ token, user: ... });
});
```

Step by step:

1. **`sensitiveSessionMiddleware`** requires a recently authenticated
   session before this endpoint is even reachable (see the `freshAge`
   configuration documented under Session 1 §1) — an old, stale session
   cannot be used to trigger a password change.
2. **Current password is verified** against the stored hash before any
   write happens — a request cannot change the password (and therefore
   cannot trigger session revocation) without proving knowledge of the
   existing password.
3. **The password hash is updated** on the account record.
4. **`deleteSessions(session.user.id)`** deletes **every** session row
   belonging to the account from the database — this is not "every session
   except the current one"; it is unconditionally all of them, including
   the session that just made this request.
5. **A brand-new session is created** (`createSession`) and its cookie is
   set on the response (`setSessionCookie`) — so the browser that just
   changed the password ends the request already holding a fresh, valid
   session rather than being logged out.

**Net effect:** any other device or browser holding a session for this
account is immediately invalidated — its session row no longer exists, so
the next request from that device fails the expiry/lookup check documented
under Session 1 §3 and is rejected as unauthorized. The device that
performed the password change is not logged out, because it is
transparently handed a new session in the same response.

---

## 3. Relationship to logout and other revocation paths

This reuses the exact same invalidation primitive documented under
[Session 1](./session-1-logout-expiration.md) — deleting rows from the
`Session` table — rather than a separate mechanism. The distinction from
plain logout is that logout deletes only the single session performing the
logout, whereas a password change deletes the account's entire session set
and then issues one new session to replace the one that was just deleted
out from under the requesting device. The same `revokeOtherSessions`
pattern is also used on the unauthenticated password-reset flow
(`revokeSessionsOnPasswordReset: true`, `packages/auth/auth.ts:802`),
though that flow has no "current session" to reissue since the user was not
authenticated when initiating the reset.

---

## Verification

- **Checked against:** `apps/web/modules/saas/settings/components/ChangePassword.tsx`
  (client request), the self-hosted auth layer's `/change-password`
  endpoint implementation (`update-user.mjs`, package
  `better-auth@1.4.22`), `packages/auth/auth.ts` (`freshAge`,
  `revokeSessionsOnPasswordReset`).
- **Date:** 2026-09-16.
- **Re-verify if:** `revokeOtherSessions` is no longer passed from the
  change-password form, the auth library is upgraded and its
  `/change-password` implementation changes (in particular, whether it
  still deletes *all* sessions and reissues one, versus deleting only
  others), or `sensitiveSessionMiddleware` / `freshAge` configuration
  changes.
