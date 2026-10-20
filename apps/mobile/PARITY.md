# Feature parity: web → mobile

Scope (as agreed): mirror **every** signed-in web feature, including those
hidden in the web UI by `config.ui` switches (Bills, Creator mode,
Integrations). Public marketing pages are out of scope.

Status values:

- ✅ **Done**: implemented against the real API.
- 🟡 **Partial**: works, with the stated difference.
- ⛔ **Blocked**: cannot be done without backend or platform changes outside this task. The app labels it in place and offers no fake behaviour.
- ➖ **N/A**: disabled on the server, so it has nothing to mirror.

## Authentication & session

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Google sign-in | ✅ | ✅ | System browser + PKCE hand-off (`/api/mobile-auth`), bearer session token in secure storage. |
| Microsoft sign-in | ✅ | ⛔ | Microsoft OAuth isn't configured on the server (`provider_unavailable`). The button is shown and reports this. |
| Magic-link sign-in | ✅ | ⛔ | The emailed link opens the web origin and sets a cookie session there. Handing it to the app would need a deep link or universal link plus a mobile-auth variant. |
| Password sign-in | ➖ | ➖ | Disabled in the UI (`enablePasswordLogin: false`). |
| Passkeys | ➖ | ➖ | `enablePasskeys: false`. |
| Sign out | ✅ | ✅ | Revokes the session server-side. |
| Auto sign-out on 401 | ✅ | ✅ | |
| Onboarding gate | ✅ | ✅ | Auto-completes once a mailbox exists, as on the web. Otherwise: name step, then connect a custom (IMAP) email. |
| Forced password change (`mustChangePassword`) | ✅ | ✅ | Same gate as the web layout. |
| Finish a custom-email connection started before sign-up | ✅ | ✅ | Runs once after sign-in. |

## Mail

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Mailbox switcher | ✅ | ✅ | |
| Inbox / All / Sent / Trash folders | ✅ | ✅ | Infinite scroll, pull-to-refresh (triggers sync). |
| Label views with unread counts and colours | ✅ | ✅ | Same colour hash as the web. |
| Search | ✅ | ✅ | |
| Live updates (SSE inbox events) | ✅ | ✅ | Reconnects with back-off. |
| Sync status banner | ✅ | ✅ | |
| Read message (sanitised HTML) | ✅ | ✅ | JavaScript-disabled WebView. Links open externally. |
| Archive / trash / delete / mark read or unread | ✅ | ✅ | Optimistic with rollback. Swipe actions. |
| Apply label, snooze, reminder | ✅ | ✅ | |
| Original headers / sender details | ✅ | ✅ | Headers sheet. |
| Reply / forward | ✅ | ✅ | Forward quotes the original as HTML. |
| Compose, send with undo, schedule, save draft | ✅ | 🟡 | Plain-text body. The web's rich-text toolbar (HtmlEditor) isn't mirrored. Forwarded HTML is preserved. |
| Drafts, Scheduled, Snoozed lists | ✅ | ✅ | |
| Message attachments: view or download | ✅ (list) | ⛔ | The API exposes no attachment-content endpoint for inbox messages. |
| Send attachments | ✗ | ⛔ | Not supported by the send API. |
| Push notifications | ✗ | ⛔ | No device-token registration endpoint or push provider on the backend. |

## AI

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Inbox assistant chat (streaming) | ✅ | ✅ | Conversation list, create, rename, delete, auto-title from the first message, device time zone. |
| Assistant tool approvals (send, schedule, delete, trash, meetings, events) | ✅ | 🟡 | Approve/Cancel cards. The turn resubmits automatically. **Cancel** stops the action, but the follow-up reply fails ("An error occurred") because of a backend bug: `@ai-sdk/openai-compatible` 1.0.20 sends a denied tool result to Sarvam with no `content`. The web uses the same server path. |
| Assistant replies rendered as Markdown | ✅ | ✅ | GitHub-flavoured, like the web. |
| Cited emails | ✅ | ✅ | Chips open the message. |
| Assistant personas | ✅ | 🟡 | Cosmetic only on the web (no effect on API calls), so not mirrored. |
| AI reply drafts (3 tones, intent, meeting link) | ✅ | ✅ | Bottom sheet on a message → "Use draft" opens the composer. |
| Voice: speak → transcript → assistant chat | ✅ | ✅ | AAC recording (`audio/mp4`), 120 s cap like the web. |
| Voice: speak → polished email drafts | ✅ | ✅ | `compose-voice-email`. |
| Rules assistant (proposeRule accept/reject) | ✅ | ✅ | Accept creates the rule exactly as the web's RuleConfirmationCard does. |

## Rules & automation

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Rules list, enable/disable, delete | ✅ | ✅ | |
| Rule editor (conditions + actions) | ✅ | ✅ | |
| Describe-a-rule (AI compile) | ✅ | ✅ | |
| Suggestions + first-summary telemetry | ✅ | ✅ | |
| Templates (newsletters, receipts, assistant) | ✅ | ✅ | |
| Test rule against recent mail | ✅ | ✅ | |
| Apply to recent / backfill with progress | ✅ | ✅ | |
| Activity (execution logs) | ✅ | ✅ | |

## Insights

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Dashboard (AI insight, stats, categories) | ✅ | ✅ | |
| Analytics (overview, volume, top senders) | ✅ | ✅ | |
| Notifications (list, mark read) | ✅ | ✅ | |
| Calendar (events, create event or meeting) | ✅ | ✅ | |

## Payments board (Bills)

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Board by status with mailbox/type/search filters | ✅ | ✅ | Tabs in place of columns. |
| Move a card between statuses | ✅ (drag) | ✅ | "Move to…" menu, optimistic with rollback. |
| Detail: amount, merchant, due date, source, body | ✅ | ✅ | |
| Download attachments | ✅ | ✅ | Opened with the system viewer. |
| Go to email | ✅ | ✅ | |

## Creator mode

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Account type (Standard / Freelancer / Creator) | ✅ | ✅ | |
| Publish page, username, display name, bio, photo | ✅ | ✅ | Photo cropped to a square PNG, like the web. |
| Links (URL / contact form, platform, featured, visible, order) | ✅ | ✅ | Reordered with up/down buttons in place of drag. |
| Booking availability (weekly windows) | ✅ | ✅ | |
| Design (accent, layout, button, font, colours, wallpaper) | ✅ | 🟡 | Same settings, edited as form controls. There is no live phone preview. Design fields the app doesn't edit are kept. |
| Media kit (stats, collaborations, rate card) | ✅ | ✅ | |
| Page analytics (30 days) | ✅ | ✅ | |
| Directory listing + tags, paid bookings | API only | ✅ | Exposed as toggles. The web has no UI for these. |
| Bookings: list, accept (meeting + email), decline | ✅ | ✅ | Same outcome messages as the web. |
| Public profile page, directory, visitor booking | ✅ (public) | ➖ | Public web pages. "View live" opens them in the browser. |

## Settings

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Avatar upload | ✅ | ✅ | Signed upload without the session token. |
| Name, email change (confirmation email) | ✅ | ✅ | |
| Language | ➖ | ➖ | Hidden on the web while only `en` exists. |
| Change password | 🟡 | ✅ | Shown when the account has a password, as on the web. |
| Two-factor (TOTP) enable/verify/disable | ✅ | ✅ | Password accounts only, as on the web. The key is shown to copy; there is no QR code. |
| Connected sign-in accounts | ✅ | 🟡 | Status is shown. **Linking** a new provider needs a browser cookie session: ⛔. |
| Active sessions, revoke | ✅ | ✅ | Revoking the current one signs out. |
| Mailboxes: health, pause/resume processing, disconnect | ✅ | ✅ | |
| Mailboxes: re-run categorisation, diagnostics | API only | ✅ | |
| Connect a custom IMAP/SMTP mailbox | ✅ | ✅ | Verify, then connect. |
| Link an additional Gmail/Outlook mailbox | ✅ | ⛔ | `linkSocial` needs a browser cookie session. The mobile hand-off only supports sign-in. |
| Telegram: connect, pause, resume | ✅ | ✅ | Opens the `t.me` deep link and polls for the connection. |
| Zoom / Zoho Meeting: status, disconnect | ✅ | ✅ | |
| Zoom / Zoho Meeting: connect | ✅ | ⛔ | Browser OAuth link flow (same limitation as above). |
| Billing: current plan, plans, trial, checkout, customer portal | ✅ | ✅ | Checkout and the portal open in the browser. Needs the price-ID defines. |
| Delete account (confirmation email) | ✅ | ✅ | |
| Organizations (settings, members, billing) | ➖ | ➖ | `organizations.enable: false`. |

## Admin

| Feature | Web | Mobile | Notes |
| --- | --- | --- | --- |
| Users list + search | ✅ | ✅ | Admin role only. The server enforces it. |
| Organizations list + search | ✅ | ✅ | |

## Unblocking the ⛔ items

- **Account linking** (extra Gmail/Outlook mailbox, Zoom, Zoho, sign-in methods): extend `/api/mobile-auth` with a `link` mode. It would start `linkSocial` in the system browser, bound to the app's session by a one-time PKCE code, and return to `mailmonkey://`.
- **Magic link:** universal links / App Links for the web domain, plus a mobile-auth variant that completes the magic link and returns a code to the app.
- **Inbox attachments:** a `GET /mailboxes/{id}/inbox/{messageId}/attachments/{attachmentId}` endpoint, like the payment-tracking one.
- **Push notifications:** device-token registration and an FCM/APNs sender.
