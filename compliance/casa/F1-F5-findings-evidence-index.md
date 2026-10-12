# CASA Findings/Evidence Index (F1–F5)

This maps the CASA portal's "Findings/Evidence" table — evidence IDs F1–F5,
each covering a set of control IDs — to what this repo can and cannot
provide directly, and links to the control docs already on file.

| ID | Covers | Requirement | Status |
|----|--------|-------------|--------|
| F1 | 2.1.1, 2.3.1, 2.3.2, 2.3.4, 3.1.5, 3.1.6, 5.1.1–5.1.10, 6.2.1, 6.3.1 | DAST scan per the ADA's Dynamic Application Security Testing Guidance. **Must be provided by Lab for Google OAuth Program.** | Lab-only — see below |
| F2 | 4.1.1, 4.1.2 | Qualys SSL Labs scan, PDF export, B or higher | **Done** — [`4.1.1-tls-configuration.md`](./4.1.1-tls-configuration.md) |
| F3 | 6.1.1 | Dependency scan (OWASP dependency-check or equivalent) | **Done** — [`6.1.1-dependency-vulnerabilities.md`](./6.1.1-dependency-vulnerabilities.md) |
| F4 | 6.5.1 | Sample log from a login process | **Done** — [`6.5.1-credential-payment-logging.md`](./6.5.1-credential-payment-logging.md) |
| F5 | 6.5.1 | Sample log from a payment process | **Done** — [`6.5.1-credential-payment-logging.md`](./6.5.1-credential-payment-logging.md) |

---

## F1 — DAST scan (lab-provided, not producible from this repo)

The deliverable is explicit: *"Must be provided by Lab for Google OAuth
Program"* — this is a dynamic scan run by Google's accredited third-party
assessor against the live, deployed application, not a scan this repo's
tooling (or I) can execute or substitute for. Nothing in this section
produces F1's actual deliverable.

What this repo *can* do is make sure the code-level controls that a DAST
scan exercises are already solid, so the lab's scan has a clean target.
Checked against this folder's index:

**Already documented, code evidence on file:**
- [`5.1.1-parameter-pollution.md`](./5.1.1-parameter-pollution.md) through
  [`5.1.10-lfi-rfi.md`](./5.1.10-lfi-rfi.md) — the full data-validation/
  injection control set (parameter pollution, open redirect, dynamic code
  execution, SSTI, SSRF, XPath/XML injection, XSS, DB injection, OS command
  injection, LFI/RFI).
- [`6.2.1-debug-mode.md`](./6.2.1-debug-mode.md) — debug modes disabled in
  production.
- [`6.3.1-origin-header-auth.md`](./6.3.1-origin-header-auth.md) — Origin
  header not used for access-control decisions.

**Not yet covered by a doc in this folder** — listed here rather than
implied as done, since claiming coverage without evidence would be worse
than an honest gap:
- **2.1.1** — not documented.
- **2.3.1, 2.3.2, 2.3.4** — not documented (likely session-management
  controls, given the 2.3.x numbering pattern elsewhere in this
  questionnaire's section headers, but unconfirmed — no doc exists yet to
  check against).
- **3.1.5, 3.1.6** — not documented (session-management section; compare
  [`3.1.1-urls-no-auth-material.md`](./3.1.1-urls-no-auth-material.md), the
  only 3.1.x control currently on file).

**Recommended next step:** treat 2.1.1, 2.3.1, 2.3.2, 2.3.4, 3.1.5, and
3.1.6 as pending controls in their own right — paste each row from the
questionnaire and they'll get the same investigate/fix/document treatment as
every other control in this folder, ahead of when F1's DAST scan actually
runs.

## F2 — Qualys SSL Labs scan

Already executed and documented. **A+** overall rating for
`staging.popsuites.ai`, tested 2026-09-10 — see
[`4.1.1-tls-configuration.md`](./4.1.1-tls-configuration.md) for the full
cipher-suite breakdown and
[`4.1.2-tls-certificate-trust.md`](./4.1.2-tls-certificate-trust.md) for the
certificate-trust chain evidence. The PDF export itself is held outside this
repo (per this folder's convention — reports can embed environment
hostnames/IPs) and attached directly to the CASA portal submission.

## F3 — Dependency scan

Already executed and documented. `pnpm audit` (this workspace's native
scanner, equivalent in purpose to OWASP dependency-check) was run against
the full monorepo lockfile; six critical/high advisories on direct,
production-reachable dependencies were fixed (`better-auth`, `@orpc/client`,
`@orpc/openapi`, `hono`, `js-cookie`, `sharp`), with the remainder traced to
dev-only tooling or confirmed-dead code paths. Full before/after table and
reproduction command (`pnpm audit`) in
[`6.1.1-dependency-vulnerabilities.md`](./6.1.1-dependency-vulnerabilities.md).

## F4 / F5 — Login and payment process log samples

Already captured, post-fix, in
[`6.5.1-credential-payment-logging.md`](./6.5.1-credential-payment-logging.md):

**Login (F4):**
```
ERROR  [APIError: Invalid email or password]
```

**Payment (F5):**
```
ERROR  Failed to create checkout link { status: 400, message: "Invalid product_id" }
```

Both samples confirm no credential, password, card data, or raw
request/response body is present in the log line — see that doc for the
full investigation (the `AuthContext`-leaking `onAPIError` hook fix, OAuth
account-object logging, the leftover webhook debug log, and the payment
error-response fix) that made these samples safe.

---

## Verification

- **Checked against:** this folder's file listing directly (`ls
  compliance/casa/`) to confirm which F1 control IDs do and don't have docs
  yet, rather than assuming based on the questionnaire's numbering.
- **Date:** 2026-09-11.
- **Re-verify if:** 2.1.1, 2.3.1, 2.3.2, 2.3.4, 3.1.5, or 3.1.6 get their own
  control docs (update the "not yet covered" list above), or the Qualys/
  dependency-scan/log-sample evidence in the linked docs is superseded by a
  re-run.
