# CASA AL0/AL1 — Access 4 (3.1.4 - AL1.2)

> **Requirement:** Provide a written description how the APIs are protected from Insecure Direct Object Reference attacks.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access**, row 5 (cell `D5`).

Companion document: [Access 3 — API inventory](./access-3-api-inventory.md), which lists every endpoint that accepts a user-supplied identifier.

---

## Summary

zeromail-app treats **every identifier arriving in a request as untrusted**. No endpoint retrieves a record by ID alone. The acting user's identity is always derived server-side from the authenticated session, and every object reference is re-validated against that identity before the record is read or mutated. This is enforced through five layers described below.

---

## Layer 1 — Authentication is a middleware, not a per-handler concern

All non-public procedures are built from `protectedProcedure` ([`packages/api/orpc/procedures.ts`](../../packages/api/orpc/procedures.ts)). The middleware resolves the session from request headers via better-auth and rejects with `UNAUTHORIZED` before the handler body executes:

```ts
export const protectedProcedure = publicProcedure.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED");
  return await next({ context: { session: session.session, user: session.user } });
});
```

A failure of the session store is deliberately surfaced as `INTERNAL_SERVER_ERROR` rather than `UNAUTHORIZED`, so a database outage can never be mistaken for a valid anonymous request.

Administrative endpoints layer `adminProcedure` on top, which additionally requires `context.user.role === "admin"` and otherwise throws `FORBIDDEN`.

## Layer 2 — The user identity is never taken from the request

The single most important anti-IDOR property: **no endpoint accepts a `userId`, `ownerId`, or equivalent as an input parameter.** The acting principal is only ever `context.user.id`, populated by the middleware from the verified session. There is no request-supplied value an attacker can change to act as another user.

## Layer 3 — Explicit ownership verification on every object reference

Mailbox- and rule-scoped endpoints call a shared verification helper before touching the resource ([`packages/api/modules/mailboxes/lib/ownership.ts`](../../packages/api/modules/mailboxes/lib/ownership.ts)):

```ts
export async function verifyMailboxOwnership(mailboxId: string, userId: string) {
  const mailbox = await getMailboxById(mailboxId);
  if (!mailbox) throw new ORPCError("NOT_FOUND");
  if (mailbox.userId !== userId) throw new ORPCError("FORBIDDEN");
  return mailbox;
}

export async function verifyRuleOwnership(ruleId: string, mailboxId: string, userId: string) {
  const rule = await getRuleById(ruleId);
  if (!rule) throw new ORPCError("NOT_FOUND");
  if (rule.mailboxId !== mailboxId) throw new ORPCError("FORBIDDEN");
  await verifyMailboxOwnership(mailboxId, userId);
  return rule;
}
```

Note that `verifyRuleOwnership` validates the **full chain** — the rule belongs to the named mailbox, *and* the mailbox belongs to the session user. Supplying a rule ID from a mailbox the attacker does own, paired with a victim's `mailboxId`, fails the first check; the reverse pairing fails the second.

Centralising this in one helper means the control is auditable in a single file rather than being reimplemented per endpoint. Every mailbox procedure calls it; the two Gmail watch diagnostics (`/mailboxes/{mailboxId}/diagnose` and `/diagnose-extended`) perform the equivalent check inline against `mailbox.userId !== context.user.id` before returning any data.

## Layer 4 — Nested resources are fetched by compound key, never by child ID alone

For every child object reachable under a mailbox, the database predicate includes the parent scope, so an ID belonging to another mailbox simply does not match:

| Endpoint | Scoped lookup |
| --- | --- |
| `POST /mailboxes/{mailboxId}/reminders/{id}/cancel` | `cancelReminder(id, mailboxId)` |
| `POST /mailboxes/{mailboxId}/scheduled/{id}/cancel` | `cancelScheduledEmail(id, mailboxId)` |
| `POST /mailboxes/{mailboxId}/snoozed/{id}/cancel` | ownership check, then explicit `snooze.mailboxId !== input.mailboxId` re-check |
| `GET /mailboxes/{mailboxId}/drafts/{draftId}` | draft resolved against the verified mailbox |
| `POST /mailboxes/{mailboxId}/inbox/{messageId}/archive` | `getEmailById(mailboxId, messageId)` |
| `POST /notifications/mark-read` | `markNotificationRead(id, user.id)` |
| `GET|PATCH|DELETE /ai/conversations/{id}` | Prisma `where: { id, userId: context.user.id }` |

A miss returns `NOT_FOUND`, which does not disclose whether the record exists under a different owner.

## Layer 5 — Provider-token isolation for external object references

Gmail and Microsoft Graph message identifiers (`messageId`, `draftId`) are passed into upstream API paths. These are protected structurally rather than by lookup: the outbound call is always made with the **OAuth token of the already-verified mailbox**, scoped to `userId: "me"` for Gmail and `/me/...` for Graph ([`gmail-client.ts`](../../packages/api/modules/mailboxes/lib/gmail-client.ts), [`outlook-client.ts`](../../packages/api/modules/mailboxes/lib/outlook-client.ts)).

Consequently a message ID belonging to another user's mailbox cannot resolve — the upstream provider itself returns 404 because that ID does not exist within the token's own mailbox. There is no code path in which a user-supplied ID selects which credential is used; the credential is chosen by the ownership check in Layer 3.

---

## Supporting controls

- **Input validation.** Every procedure declares a Zod schema; malformed or extra parameters are rejected before the handler runs, so identifiers cannot be smuggled as arrays, objects, or Prisma filter fragments.
- **Non-enumerable identifiers.** All primary keys are `cuid()` values (`packages/database/prisma/schema.prisma`), not sequential integers. This is treated as friction only — **it is not relied upon as an access control**; the checks above hold regardless of ID predictability.
- **Rate limiting.** A global limiter plus per-tier limiters on `/auth/*` and each webhook path (`packages/api/lib/rate-limit.ts`), and a `userExpensiveLimiter` middleware on costly procedures, constrain brute-force enumeration of identifiers.
- **Response shaping.** Per the project's API conventions, responses expose only the fields the client needs; internal IDs and credential fields are not returned.
- **Consistent error shapes.** Handlers throw `ORPCError` with `NOT_FOUND` / `FORBIDDEN` / `UNAUTHORIZED` rather than leaking provider or database errors to the caller.
- **Regression coverage.** Integration tests run against a real database (`packages/api/modules/**/*.integration.test.ts`, e.g. `rules.integration.test.ts`, `ai-conversations.integration.test.ts`) and include unauthorized-access cases.

---

## Known consistency gap (disclosed)

The two Gmail watch diagnostic endpoints — `POST /mailboxes/{mailboxId}/diagnose` and `POST /mailboxes/{mailboxId}/diagnose-extended` — perform a correct ownership check but return `{ error: "Not your mailbox" }` with HTTP 200 instead of throwing `ORPCError("FORBIDDEN")` like every other endpoint.

**No data belonging to another user is returned** — the handler exits before any mailbox detail is populated — so this is not an IDOR exposure. It is an error-handling inconsistency, tracked for alignment with the shared `verifyMailboxOwnership` helper.
