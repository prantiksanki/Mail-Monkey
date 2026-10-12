---
name: frontend
description: Launch zeromail-app locally and drive it with a headless browser to visually verify frontend changes (screenshots) before declaring UI work done. Use for any NavBar/sidebar/mailbox/settings UI change instead of asking the user to eyeball it.
---

# Running & verifying zeromail-app locally

This is a pnpm/Turbo monorepo (Next.js app in `apps/web`). Use this
skill any time a frontend change needs visual verification — don't ask
the user to check unless this fails.

## 1. Start infra (Postgres + MinIO)

```bash
docker compose up -d
docker compose ps   # both should show "healthy"
```

## 2. Start the dev server

```bash
pnpm dev
```

- Runs Turbopack (`next dev`, no `--webpack` — see apps/web/package.json).
- Cold start ~1.5-2s, first route compile a few seconds.
- Poll instead of sleeping:
  ```bash
  until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done
  ```
- If already running in the user's own terminal, don't kill it —
  reuse `http://localhost:3000` as-is (check with
  `lsof -i :3000 -sTCP:LISTEN -t`).

## 3. Get an authenticated session

Protected routes live under `/app/*`. There is no `chromium-cli` in
this environment — drive Playwright directly via the pnpm-installed
package:

```js
// scratch script, not committed
const { chromium } = require(
  "/Users/apple/Desktop/PopPushAIAutomation/zeromail-app/node_modules/.pnpm/playwright@1.57.0/node_modules/playwright"
);
```

Two ways to get logged in, in priority order:

1. **Test credentials** — if `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`
   are set (see `apps/web/tests/auth.setup.ts`), reuse that setup's
   login flow (`/auth/login`, fill email + password, submit, wait for
   redirect to `/app`) and save `context.storageState()` to a scratch
   file for reuse across runs. **As of 2026-07-08 these are not set** —
   ask the user to add them to `apps/web/.env.local` if you want fully
   unattended verification.
2. **Borrow the user's live session** — if the user already has the
   app open and logged in in their own browser, ask them to export
   cookies, or ask them to run the login once while you drive the
   browser (`page.pause()`-style handoff isn't available headlessly,
   so prefer option 1).

Without either, fall back to visually inspecting only the parts of the
UI that don't require auth (marketing/blog/legal pages), and be
explicit with the user that protected-route verification was skipped.

## 4. Drive + screenshot

```js
const page = await context.newPage();
await page.goto("http://localhost:3000/app/mailboxes?folder=inbox");
await page.waitForSelector("text=Inbox");
await page.screenshot({ path: "/tmp/.../sidebar.png", fullPage: false });
```

- For sidebar/nav changes: screenshot just the sidebar
  (`page.locator("aside").screenshot(...)`) so the diff is easy to eyeball.
- For collapse/expand toggles: click the toggle, wait for the
  transition (`transition-[transform,width] duration-200` — wait
  ~250ms or wait for the width class to change), then screenshot again.
- Check `page.on("console", ...)` / `page.on("pageerror", ...)` for
  runtime errors before declaring success — a page can render its
  shell while a query 400s underneath.

## 5. Compare against the spec

If the user provided screenshots of the target design, read this
skill's output screenshot back with the Read tool and compare
side-by-side before saying the change is done. Don't just assert it
matches — look.

## Known gaps (update this file when fixed)

- No saved auth session yet — every verification run currently
  requires either test credentials or a manual login.
- `chromium-cli` is not installed in this environment; using raw
  Playwright via the pnpm store path above works but is more verbose.
