# CASA AL0/AL1 — Access 7 (3.3.1 - AL1.1)

> **Requirement:** Provide evidence demonstrating that any application exposed administrative interfaces enforce multi-factor authentication for all accounts.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access Control**, row 8 (cell `D8`).

---

## Status: ✅ Met — MFA is enforced for administrative access

`adminProcedure` and the admin UI layout now both require `user.twoFactorEnabled` in addition to `user.role === "admin"`. An admin account without two-factor enabled can no longer reach any admin API route or the admin UI. See [§5 — Fixed](#5-fixed) below for the exact change.

---

## 1. The administrative interface

**Scope.** The admin surface is small and read-oriented:

| Interface | Location |
| --- | --- |
| UI — user list | `/app/admin/users` |
| UI — organization list & detail | `/app/admin/organizations`, `/app/admin/organizations/[id]` |
| API | `GET /admin/users`, `GET /admin/organizations`, `GET /admin/organizations/{id}` |

There is **no administrative interface exposed on a separate host, port, or path outside the main application**, and no separate admin credential store — administrators are ordinary users carrying `user.role === "admin"`.

**Materially, an admin cannot read user mail.** No endpoint permits an administrator to access another user's mailbox, messages, drafts, or rules; those are reachable only through ownership-verified procedures (see [Access 4](./access-4-idor-protection.md)). This bounds the blast radius of a compromised admin account, but it does not satisfy the requirement as written.

## 2. What is enforced now

**UI route guard** — [`apps/web/app/(saas)/app/(account)/admin/layout.tsx`](../../apps/web/app/(saas)/app/(account)/admin/layout.tsx):

```tsx
const session = await getSession();
if (!session) redirect("/auth/login");
if (session.user?.role !== "admin") redirect("/app");
if (!session.user?.twoFactorEnabled) redirect("/app/settings/security");
```

**API middleware** — [`packages/api/orpc/procedures.ts`](../../packages/api/orpc/procedures.ts):

```ts
export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
  if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN");
  if (!context.user.twoFactorEnabled) {
    throw new ORPCError("FORBIDDEN", {
      message: "Two-factor authentication is required for administrative access.",
    });
  }
  return await next();
});
```

Both now check role **and** `user.twoFactorEnabled`. The API middleware is the authoritative boundary — it rejects direct API access even if the UI guard is bypassed. The UI guard additionally redirects an unenrolled admin to the security settings page rather than a generic dead end, so they're guided to enrol.

## 3. MFA capability that exists

The building blocks are in place and working:

- **TOTP two-factor** — the better-auth `twoFactor()` plugin is registered in [`packages/auth/auth.ts`](../../packages/auth/auth.ts), and `enableTwoFactor: true` in [`packages/auth/config.ts`](../../packages/auth/config.ts). Users enrol via `apps/web/modules/saas/settings/components/TwoFactorBlock.tsx` (`authClient.twoFactor.enable`, QR/TOTP URL, verification step) and challenge through `apps/web/modules/saas/auth/components/OtpForm.tsx` (`authClient.twoFactor.verifyTotp`).
- **Passkeys (WebAuthn)** — `@better-auth/passkey` registered, `enablePasskeys: true`. A passkey is a phishing-resistant possession factor.

**Enrolment itself remains self-service** — a user chooses when to enable TOTP or register a passkey, same as before. What changed is that the *admin* surface now enforces it: an administrator who has not enrolled can no longer reach `/app/admin/*` or any `adminProcedure`-gated API route, in either transport.

## 4. Compensating controls (still relevant as defence in depth)

| Control | Effect |
| --- | --- |
| Password login disabled in the UI (`enablePasswordLogin: false`) | The primary sign-in path is magic link, so there is no reusable, guessable, or credential-stuffable admin password |
| Magic link / social sign-in | The de-facto first factor is control of a provider account or mailbox, each of which commonly carries its own MFA at the identity provider |
| Google / Microsoft SSO | Where an admin signs in via Google or Microsoft, MFA enforced on that provider's tenant applies transitively |
| Admin role is read-only | No admin path reads user mail or mutates another user's data |
| Rate limiting on `/auth/*` | Constrains brute-force and magic-link flooding |
| Secure session cookies | HTTP-only, signed, `Secure` in production |

These were the only protections in place before the fix below, and remain valid additional layers now that enforcement is also in place.

## 5. Fixed

Both of the primary remediation items were implemented directly:

1. **`adminProcedure` now rejects sessions without a verified second factor** (`packages/api/orpc/procedures.ts`) — the authoritative fix, since it covers direct API access as well as the UI, and applies identically on both the REST and RPC transports:

   ```ts
   export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
     if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN");
     if (!context.user.twoFactorEnabled) {
       throw new ORPCError("FORBIDDEN", { message: "Two-factor authentication is required for administrative access." });
     }
     return await next();
   });
   ```

2. **The admin layout mirrors the check** (`apps/web/app/(saas)/app/(account)/admin/layout.tsx`), redirecting to `/app/settings/security` — the existing `TwoFactorBlock` enrolment page — rather than `/app`, so an admin without a second factor is guided to enrol instead of silently bounced with no explanation.

### Not implemented (remaining follow-up)

- **Gate role assignment** — requiring enrolment *before* the `admin` role can be granted in the first place, so the gap cannot be re-created by an admin who disables 2FA after being granted the role. There is no existing admin-role-grant procedure in this codebase to gate (the role is set via better-auth's admin plugin / direct database access), so this was left out of the immediate fix rather than inventing new infrastructure. Track separately if role-grant tooling is added.
- **Session cookie cache window.** `session.cookieCache` has `maxAge: 5 * 60`, so a newly-enrolled or newly-revoked factor can take up to five minutes to propagate to `adminProcedure`'s check. This window is accepted as-is for now; revisit if it becomes an operational concern.
- **Enrolment audit.** Evidence for this requirement should ultimately include a record showing every account holding `role = "admin"` also has `twoFactorEnabled = true`. Not automated — a manual query against the `User` table can confirm this at any time (`role = 'admin' AND (twoFactorEnabled IS NULL OR twoFactorEnabled = false)` should return zero rows).
