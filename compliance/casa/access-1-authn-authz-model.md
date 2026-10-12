# CASA AL0/AL1 — Access 1 (3.1.1 - AL1.1)

> **Requirement:** Explain / provide documentation how user authentication and authorization are implemented, what roles and permissions are defined, and how access control rules are enforced when users interact with the application.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access Control**, row 2 (cell `D2`).

---

## 1. Authentication

Authentication is implemented with **better-auth 1.4.7** ([`packages/auth/auth.ts`](../../packages/auth/auth.ts)), backed by PostgreSQL through the Prisma adapter. It is the single authority for identity; the application defines no bespoke credential handling, password hashing, or session issuance of its own.

### Enabled sign-in methods

Feature flags live in [`packages/auth/config.ts`](../../packages/auth/config.ts):

| Method | Status | Notes |
| --- | --- | --- |
| Magic link (email) | Enabled | Primary sign-in path |
| Social — Google | Enabled | Also provisions the Gmail mailbox |
| Social — Microsoft | Enabled | Also provisions the Outlook mailbox |
| Passkeys (WebAuthn) | Enabled | `@better-auth/passkey` |
| TOTP two-factor | Available, self-service | See [Access 7](./access-7-admin-mfa.md) |
| Password login | **Disabled in the UI** (`enablePasswordLogin: false`) | Deliberately dropped in favour of magic link |

Note that `emailAndPassword.enabled` remains `true` in the better-auth config so that password-dependent flows (for example the re-authentication step when enrolling TOTP) keep working; the `enablePasswordLogin: false` flag governs what the sign-in UI offers.

### Identity assurance controls

- **Email verification** is sent on signup (`emailVerification.sendOnSignUp`) and required for email/password signups while public signup is enabled (`requireEmailVerification`).
- **Google ID tokens are cryptographically verified** before being trusted. `createMailboxAfterAccountCreation` calls `jwtVerify` against Google's remote JWKS (`https://www.googleapis.com/oauth2/v3/certs`) pinned to issuer `https://accounts.google.com`, the app's own `GOOGLE_CLIENT_ID` as audience, and `RS256`. A token failing signature, issuer, or audience validation throws and the mailbox is not created. The `email_verified` claim is checked and a warning logged when false.
- **Microsoft identity** is read from Graph `/me` using the freshly issued access token rather than from client-supplied data.
- **Account linking** is restricted to `trustedProviders: ["google", "microsoft"]`. `allowDifferentEmails: true` is set so a user whose Google and Microsoft addresses differ can attach both mailboxes to one account; linking is only ever performed from a provider-verified profile, never from a user-supplied address.
- **Invitation-only gating** is available via a local plugin ([`packages/auth/plugins/invitation-only`](../../packages/auth/plugins/invitation-only/index.ts)).

### Session handling

```ts
session: {
  expiresIn: config.sessionCookieMaxAge,   // 30 days
  freshAge: 0,
  cookieCache: { enabled: true, maxAge: 5 * 60 },
},
advanced: {
  useSecureCookies: process.env.NODE_ENV === "production",
},
```

Sessions are carried in signed HTTP-only cookies, marked `Secure` in production. A 5-minute signed cookie cache serves session reads without a database round-trip; the trade-off is documented in-code — revocations and role changes propagate within at most 5 minutes.

`trustedOrigins` is pinned to the application's own base URL, extensible only through the `BETTER_AUTH_TRUSTED_ORIGINS` environment variable for development tunnels. See [Access 6](./access-6-oauth-state-redirect-uri.md) for how this feeds redirect validation.

---

## 2. Roles and permissions

The model is intentionally small. Two scopes of role exist:

### Platform roles (`user.role`, better-auth `admin()` plugin)

| Role | Grants |
| --- | --- |
| *(default / unset)* | Standard end user. Access confined to their own mailboxes and records. |
| `admin` | Additionally: list all users, list all organizations, read a single organization by ID. |

Administrative capability is **read-oriented**: the admin surface consists of `GET /admin/users`, `GET /admin/organizations`, and `GET /admin/organizations/{id}`. There is no endpoint permitting an admin to read another user's mail, rules, drafts, or mailbox contents — mailbox data is reachable only through ownership-verified procedures.

### Organization roles (better-auth `organization()` plugin)

`owner` / `admin` / `member`, applied to organization membership and invitations. **Organizations are currently disabled** (`config.organizations.enable: false`, `enableUsersToCreateOrganizations: false`) while the product focuses on personal mailbox management, so this role set is dormant in production.

There are no other permission primitives — no ACLs, no per-resource grants. Authorization is expressed as *ownership* (see below) plus the single `admin` role bit.

---

## 3. How access control is enforced

Enforcement happens at three layers, each independent of the others.

### Layer A — API middleware (authoritative)

All API endpoints are oRPC procedures composed from a small set of base procedures in [`packages/api/orpc/procedures.ts`](../../packages/api/orpc/procedures.ts):

```ts
export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return await next({ context: { session: session.session, user: session.user } });
});

export const adminProcedure = protectedProcedure.use(async ({ context, next }) => {
  if (context.user.role !== "admin") throw new ORPCError("FORBIDDEN");
  return await next();
});
```

Because authentication is a middleware rather than a per-handler call, an endpoint cannot accidentally ship without it — the developer must actively choose `publicProcedure` to expose something unauthenticated. A session-store failure is surfaced as `INTERNAL_SERVER_ERROR`, deliberately distinct from `UNAUTHORIZED`, so a database outage can never be misread as a valid anonymous request.

### Layer B — Per-request ownership verification

The acting user is always `context.user.id` from the verified session; **no endpoint accepts a user identifier as input.** Every object reference is re-validated against that identity before use, via the shared helpers in [`packages/api/modules/mailboxes/lib/ownership.ts`](../../packages/api/modules/mailboxes/lib/ownership.ts) (`verifyMailboxOwnership`, `verifyRuleOwnership`) and by compound-key database predicates for nested resources.

This is documented in full, with the per-endpoint evidence table, in [Access 4 — IDOR protection](./access-4-idor-protection.md).

### Layer C — UI route guards (defence in depth, not relied upon)

Server components guard the rendered routes. For example [`apps/web/app/(saas)/app/(account)/admin/layout.tsx`](../../apps/web/app/(saas)/app/(account)/admin/layout.tsx):

```tsx
const session = await getSession();
if (!session) redirect("/auth/login");
if (session.user?.role !== "admin") redirect("/app");
```

This runs server-side, but it governs *navigation only*. The security boundary is Layer A — the `adminProcedure` middleware independently rejects a non-admin calling `/admin/*` directly, so bypassing the UI gains nothing.

---

## 4. Supporting controls

- **Input validation.** Every procedure declares a Zod schema; inputs are parsed before the handler body runs.
- **Rate limiting.** A global limiter plus tighter per-tier limiters on `/auth/*` and each webhook path ([`packages/api/lib/rate-limit.ts`](../../packages/api/lib/rate-limit.ts)), and a `userExpensiveLimiter` middleware on costly procedures.
- **Machine-to-machine endpoints.** Internal cron routes under `/api/internal/*` are gated on `Authorization: Bearer ${CRON_SECRET}` rather than on a user session ([`packages/api/index.ts`](../../packages/api/index.ts)).
- **Webhook authenticity.** Gmail, Outlook, payments, and Telegram webhooks each verify provider signatures/tokens and are separately rate-limited.
- **CORS.** Restricted to the application's own origin with `credentials: true`; only `GET`, `POST`, `OPTIONS` are permitted.
- **Consistent error shapes.** Handlers throw `ORPCError` with `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND`; provider and database errors are logged server-side, not returned to callers.
