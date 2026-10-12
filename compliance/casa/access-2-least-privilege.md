# CASA AL0/AL1 — Access 2 (3.1.1 - AL1.2)

> **Requirement:** Explain / provide documentation that the principle of least privilege exists — users should only be able to access functions, data files, URLs, controllers, services, and other resources, for which they possess specific authorization.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access Control**, row 3 (cell `D3`).

Companion documents: [Access 1 — authn/authz model](./access-1-authn-authz-model.md), [Access 4 — IDOR protection](./access-4-idor-protection.md).

---

## Summary

zeromail-app is **deny-by-default**. A user's reachable surface is the set of records they own, plus a single optional `admin` role bit that grants read-only visibility over user and organization listings and nothing more. Privilege is never inherited from a request parameter, and third-party access is constrained by the narrowest OAuth scopes that support the product's features.

---

## 1. Functions — deny by default at the API layer

Every endpoint is an oRPC procedure built from one of three base procedures ([`packages/api/orpc/procedures.ts`](../../packages/api/orpc/procedures.ts)):

| Base | Privilege granted |
| --- | --- |
| `publicProcedure` | None — unauthenticated |
| `protectedProcedure` | Authenticated user, scoped to their own records |
| `adminProcedure` | The above plus `user.role === "admin"` |

Authentication and role checks are **middleware**, so an endpoint gains privilege only by explicitly opting into a lower tier. The full endpoint inventory is in [Access 3](./access-3-api-inventory.md); the only deliberately public endpoints are:

- `POST /contact`, `POST /newsletter` — anonymous form submissions
- `GET /api/health` — liveness probe, returns the literal string `OK`
- `/api/auth/**` — the better-auth handler (sign-in itself)
- `POST /api/webhooks/{gmail,outlook,payments,telegram}` — provider callbacks, each authenticated by provider signature/token rather than by session

Everything else requires a session.

## 2. Data — users reach only their own records

The authorization model is ownership, not an ACL. The acting principal is always `context.user.id`, taken from the verified session; **no endpoint accepts a `userId` parameter**, so there is no value an attacker can vary to act as somebody else.

Every object reference is re-validated before use:

```ts
export async function verifyMailboxOwnership(mailboxId: string, userId: string) {
  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox) throw new ORPCError("NOT_FOUND");
  if (mailbox.userId !== userId) throw new ORPCError("FORBIDDEN");
  return mailbox;
}
```

Nested resources (drafts, rules, reminders, scheduled sends, snoozes, messages, notifications, AI conversations) are fetched by **compound key** that includes the owning scope — never by child ID alone. Full per-endpoint evidence is tabulated in [Access 4](./access-4-idor-protection.md).

Notably, **the `admin` role does not confer data access.** There is no endpoint through which an administrator can read another user's mail, drafts, rules, or mailbox contents; mailbox data is reachable exclusively through ownership-verified procedures. Admin capability is limited to `GET /admin/users`, `GET /admin/organizations`, and `GET /admin/organizations/{id}`.

## 3. Third-party scopes — narrowest viable grant

The application holds delegated access to users' mail, so scope minimisation is the highest-value least-privilege control here. Requested scopes ([`packages/auth/auth.ts`](../../packages/auth/auth.ts)):

**Google**
`email`, `profile`, `gmail.modify`, `gmail.send`, `calendar.readonly`, `calendar.events`

`gmail.modify` is requested rather than the full-access `https://mail.google.com/` scope, which would additionally grant IMAP/SMTP and permanent-delete rights the product does not need. Calendar is split so that read access (`calendar.readonly`) is not silently widened — `calendar.events` is requested specifically to create Google Meet links, and the reason is recorded in a code comment.

**Microsoft**
`openid`, `profile`, `email`, `offline_access`, `User.Read`, `Mail.ReadWrite`, `Mail.Send`

**Optional, per-environment providers.** Zoom, Zoho Meeting, and HubSpot are registered **only when their credentials are present** in the environment, so an environment without a Zoom app carries no Zoom provider and no Zoom attack surface at all:

```ts
if (zoomClientId && zoomClientSecret) { genericOAuthConfigs.push({ ... }); }
```

Their scopes are likewise minimal and overridable per environment — Zoom `meeting:write:meeting,user:read:user`; Zoho `ZohoMeeting.meeting.CREATE,AaaServer.profile.READ`; HubSpot read scopes on contacts/companies/deals plus `crm.objects.contacts.write`.

The Zoho configuration deliberately avoids the `openid` scope: a code comment records that its presence makes Zoho silently drop the service scope, and `AaaServer.profile.READ` carries identity instead. This is a correctness note, but it also keeps the grant to exactly what the meeting feature requires.

## 4. Services and credentials

- **Credential isolation.** Outbound Gmail and Microsoft Graph calls always use the OAuth token belonging to the *already ownership-verified* mailbox, scoped to `userId: "me"` / `/me/...`. No code path lets a user-supplied identifier select which credential is used, so a user cannot address another tenant's mailbox even in principle.
- **Machine-to-machine separation.** Internal cron endpoints (`/api/internal/cron/*`) authenticate with `Authorization: Bearer ${CRON_SECRET}` and carry no user session. They are not reachable with user credentials, and user endpoints are not reachable with the cron secret.
- **Secrets stay server-side.** Provider client secrets and `CRON_SECRET` are read from environment variables in server-only packages; none is exposed to the browser bundle.
- **Organization features are switched off.** `config.organizations.enable: false` and `enableUsersToCreateOrganizations: false` — the organization role set (`owner`/`admin`/`member`) is dormant, removing an entire privilege surface rather than merely guarding it.

## 5. URLs and controllers

There is one HTTP entry point — a Next.js catch-all mounting a Hono app at `/api` — so there are no unrouted or orphaned controllers to audit. Route-level UI guards (for example the admin layout's `session.user?.role !== "admin"` redirect) provide defence in depth, but the enforcing boundary is the API middleware: calling an admin endpoint directly without the role still returns `FORBIDDEN`.

## 6. Supporting controls

- **Rate limiting** — global, per-tier on `/auth/*` and webhooks, plus `userExpensiveLimiter` on costly procedures, limiting how far any single principal can push their privileges.
- **Response shaping** — responses return only the fields the client needs; internal identifiers and credential fields are not serialised.
- **Input validation** — Zod schemas reject unexpected parameters before handlers execute.
- **Regression coverage** — integration tests run against a real database and include unauthorized-access cases (`packages/api/modules/**/*.integration.test.ts`).
