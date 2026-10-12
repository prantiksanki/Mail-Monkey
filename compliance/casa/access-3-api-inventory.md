# CASA AL0/AL1 — Access 3 (3.1.4 - AL1.1)

> **Requirement:** Provide a list of APIs in which portions of the API/URL or parameters may be passed from the user into the application.

Source workbook: `CASA AL0 and AL1 Onboarding Questionnaire.xlsx`, sheet **Access**, row 4 (cell `D4`).

Compiled from the route definitions in `packages/api/` on branch `feature/auto-reply`.

---

## 1. Shape of the API surface

Everything is served from one Next.js catch-all handler ([`apps/web/app/api/[[...rest]]/route.ts`](../../apps/web/app/api/%5B%5B...rest%5D%5D/route.ts)) mounted on a Hono app at `/api` ([`packages/api/index.ts`](../../packages/api/index.ts)). Business endpoints are oRPC procedures under `packages/api/modules/*/procedures/`, exposed on **two transports**:

| Transport | Prefix | Where user input lands |
| --- | --- | --- |
| OpenAPI / REST | `/api/...` | URL path segments + query string + JSON body |
| RPC | `/api/rpc/...` | JSON body only (no user data in the path) |

Every procedure listed below is therefore reachable both as a REST path *and* as an RPC call. All inputs are parsed by a Zod schema before the handler runs.

---

## 2. APIs taking user-supplied values in the URL path

`{mailboxId}`, `{messageId}`, `{id}`, `{draftId}` and `{ruleId}` are all client-controllable identifiers.

### Mailboxes — messages
`packages/api/modules/mailboxes/procedures/`

- `GET /mailboxes/{mailboxId}/inbox` — plus query params `folder`, `label`, `search`, `pageToken`, `maxResults`
- `GET /mailboxes/{mailboxId}/inbox/{messageId}`
- `GET /mailboxes/{mailboxId}/inbox/{messageId}/headers`
- `GET /mailboxes/{mailboxId}/inbox/label-counts`
- `GET /mailboxes/{mailboxId}/inbox/sync-status`
- `POST /mailboxes/{mailboxId}/inbox/sync`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/archive`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/trash`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/delete`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/mark-read`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/mark-unread`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/label`
- `POST /mailboxes/{mailboxId}/inbox/{messageId}/snooze`
- `POST /mailboxes/{mailboxId}/messages/{messageId}/modify`

### Mailboxes — send / schedule / snooze / drafts

- `POST /mailboxes/{mailboxId}/send`
- `POST /mailboxes/{mailboxId}/schedule`
- `GET /mailboxes/{mailboxId}/scheduled`
- `POST /mailboxes/{mailboxId}/scheduled/{id}/cancel`
- `GET /mailboxes/{mailboxId}/snoozed`
- `POST /mailboxes/{mailboxId}/snoozed/{id}/cancel`
- `GET|POST /mailboxes/{mailboxId}/drafts`
- `GET /mailboxes/{mailboxId}/drafts/{draftId}`
- `POST /mailboxes/{mailboxId}/drafts/{draftId}/send`
- `POST /mailboxes/{mailboxId}/drafts/{draftId}/delete`

### Mailboxes — rules

- `GET|POST /mailboxes/{mailboxId}/rules`
- `PUT|DELETE /mailboxes/{mailboxId}/rules/{id}`
- `POST /mailboxes/{mailboxId}/rules/{id}/toggle`
- `POST /mailboxes/{mailboxId}/rules/{id}/test`
- `POST /mailboxes/{mailboxId}/rules/compile`
- `POST /mailboxes/{mailboxId}/rules/apply-recent`
- `GET /mailboxes/{mailboxId}/rules/suggestions`
- `POST /mailboxes/{mailboxId}/rules/{ruleId}/backfill/start` (plus `advance`, `status`)

### Mailboxes — reminders, calendar, watch, operations

- `GET|POST /mailboxes/{mailboxId}/reminders`
- `POST /mailboxes/{mailboxId}/reminders/{id}/cancel`
- `GET /mailboxes/{mailboxId}/calendar/events`
- `POST /mailboxes/{mailboxId}/calendar/event`
- `POST /mailboxes/{mailboxId}/calendar/meeting`
- `POST /mailboxes/{mailboxId}/watch/enable`
- `POST /mailboxes/{mailboxId}/watch/disable`
- `GET /mailboxes/{mailboxId}/watch/status`
- `GET /mailboxes/{mailboxId}/diagnose`
- `GET /mailboxes/{mailboxId}/diagnose-extended`
- `GET /mailboxes/{mailboxId}/test-gmail`
- `POST /mailboxes/{mailboxId}/disconnect`
- `GET /mailboxes/{mailboxId}/stats`
- `GET /mailboxes/{mailboxId}/dashboard/summary`
- `GET /mailboxes/{mailboxId}/execution-logs`
- `POST /mailboxes/{mailboxId}/classification/start` (plus `advance`, `status`)

### AI

- `GET|DELETE|PATCH /ai/conversations/{id}`

### Admin (admin-gated)

- `GET /admin/organizations/{id}`

### Server-Sent Events (non-oRPC Hono route)

- `GET /api/mailboxes/:mailboxId/inbox/events` — [`packages/api/index.ts`](../../packages/api/index.ts)

---

## 3. APIs taking user input only as query/body parameters

No user-controlled path segment; user data still enters via query string or request body.

- `GET /analytics/overview`, `/analytics/email-volume`, `/analytics/top-senders`
- `GET|POST /ai/conversations`
- `POST /ai/inbox-assistant`, `/ai/rules-assistant`, `/ai/generate-drafts`
- `POST /ai/transcribe-voice` (audio upload)
- `POST /crm/hubspot/lookup` (email address), `POST /crm/hubspot/contacts`
- `GET /notifications`, `POST /notifications/mark-read`
- `GET /organizations/generate-slug`, `POST /organizations/logo-upload-url`
- `GET /users/connected-mailboxes`, `POST /users/avatar-upload-url`
- `POST /payments/create-checkout-link`, `/create-customer-portal-link`, `/start-trial`
- `GET /payments/purchases`
- `GET /admin/users`, `GET /admin/organizations` (admin-gated)

### Unauthenticated endpoints

- `POST /contact`
- `POST /newsletter`
- `GET /api/health`
- `/api/auth/**` (better-auth handler)
- `POST /api/webhooks/gmail`, `/outlook`, `/payments`, `/telegram` — each signature/token verified and rate-limited

---

## 4. Where user-supplied values reach an outbound API/URL

Most relevant to this control: the user's value becomes part of a third-party request path or query.

| User input | Outbound destination | Location |
| --- | --- | --- |
| `messageId`, `draftId` | Gmail API — always scoped to `userId: "me"` on the mailbox's own OAuth token | [`gmail-client.ts`](../../packages/api/modules/mailboxes/lib/gmail-client.ts) |
| `messageId`, `subscriptionId`, `categoryId` | Microsoft Graph — e.g. `/me/messages/${messageId}` | [`outlook-client.ts`](../../packages/api/modules/mailboxes/lib/outlook-client.ts) |
| HubSpot contact id | `/crm/v4/objects/contacts/${id}/associations/deals` | [`hubspot-client.ts`](../../packages/api/modules/crm/lib/hubspot-client.ts) |
| `search`, `label` | Gmail `q` and `labelIds` query params | [`list-inbox-messages.ts`](../../packages/api/modules/mailboxes/procedures/list-inbox-messages.ts) |

In every case the base URL and host are hard-coded and only a single path segment or query value is user-derived — **no user input selects the destination host.**

---

## 5. Controls applied

Relevant to the follow-up question Access 4 (3.1.4 - AL1.2, IDOR).

- Every endpoint above except the explicitly public ones uses `protectedProcedure` (`packages/api/orpc/procedures.ts`).
- All inputs are validated against a Zod schema before the handler body runs.
- Resource identifiers are re-checked against the session owner via `verifyMailboxOwnership` / `verifyRuleOwnership` in [`packages/api/modules/mailboxes/lib/ownership.ts`](../../packages/api/modules/mailboxes/lib/ownership.ts), which throws `NOT_FOUND` when the record is absent and `FORBIDDEN` when it belongs to another user — the supplied ID is never trusted on its own.
- The SSE route performs the same ownership check inline before opening the stream.
- Rate limiting is applied globally and per-tier on `/auth/*` and each webhook path (`packages/api/lib/rate-limit.ts`).
- Internal `/api/internal/cron/*` endpoints require `Authorization: Bearer ${CRON_SECRET}`.
