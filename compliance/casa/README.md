# CASA Certification — Evidence & Control Responses

Google **CASA** (Cloud Application Security Assessment) Tier 2 self‑assessment for the
Gmail restricted‑scope verification. This folder holds our written answers and the
code evidence backing each control, so the team has one source of truth to hand to
the assessor.

## How this is organised

| File | Control |
|------|---------|
| [`1.1.2-authentication.md`](./1.1.2-authentication.md) | 1.1.2 — Implement strong password security measures (initial passwords / activation codes) |
| [`1.1.3-password-storage.md`](./1.1.3-password-storage.md) | 1.1.3 — Implement strong password security measures (passwords resistant to offline attacks) |
| [`1.2.1-default-accounts.md`](./1.2.1-default-accounts.md) | 1.2.1 — Disable any default accounts for public application access interfaces |
| [`1.3.1-oob-verifiers.md`](./1.3.1-oob-verifiers.md) | 1.3.1 — Out of band verifiers shall be random and not reused (expiry) |
| [`1.3.2-oob-single-use.md`](./1.3.2-oob-single-use.md) | 1.3.2 — Out of band verifiers shall be random and not reused (used exactly once) |
| [`1.3.3-oob-verifier-randomness.md`](./1.3.3-oob-verifier-randomness.md) | 1.3.3 — Out of band verifiers shall be random and not reused (securely random) |
| [`1.3.4-oob-verifier-brute-force.md`](./1.3.4-oob-verifier-brute-force.md) | 1.3.4 — Out of band verifiers shall be random and not reused (brute-force resistant) |
| [`3.1.1-urls-no-auth-material.md`](./3.1.1-urls-no-auth-material.md) | 3.1.1 (Session Management) — URLs shall not expose authentication material *(DAST deliverable pending)* |
| [`4.1.1-tls-configuration.md`](./4.1.1-tls-configuration.md) | 4.1.1 (Communications) — Enforce TLS 1.2+ and secure cipher suites |
| [`4.1.2-tls-certificate-trust.md`](./4.1.2-tls-certificate-trust.md) | 4.1.2 (Communications) — Connections use trusted TLS certificates |
| [`4.1.3-cryptographic-operations.md`](./4.1.3-cryptographic-operations.md) | 4.1.3 (Communications) — No weak cryptography; full crypto operations inventory |
| [`4.1.4-secure-crypto-failures.md`](./4.1.4-secure-crypto-failures.md) | 4.1.4 (Communications) — Cryptographic modules fail securely, no padding-oracle exposure |
| [`5.1.1-parameter-pollution.md`](./5.1.1-parameter-pollution.md) | 5.1.1 (Data Validation and Sanitization) — Protect against HTTP parameter pollution |
| [`5.1.2-open-redirect.md`](./5.1.2-open-redirect.md) | 5.1.2 (Data Validation and Sanitization) — Limit redirects/forwards to allowlisted URLs |
| [`5.1.3-dynamic-code-execution.md`](./5.1.3-dynamic-code-execution.md) | 5.1.3 (Data Validation and Sanitization) — Avoid eval()/dynamic code execution |
| [`5.1.4-template-injection.md`](./5.1.4-template-injection.md) | 5.1.4 (Data Validation and Sanitization) — Protect against template injection (SSTI) |
| [`5.1.5-ssrf.md`](./5.1.5-ssrf.md) | 5.1.5 (Data Validation and Sanitization) — Prevent Server-Side Request Forgery (SSRF) |
| [`5.1.6-xpath-xml-injection.md`](./5.1.6-xpath-xml-injection.md) | 5.1.6 (Data Validation and Sanitization) — Protect against XPath/XML injection |
| [`5.1.7-xss.md`](./5.1.7-xss.md) | 5.1.7 (Data Validation and Sanitization) — Context-aware output escaping protects against XSS |
| [`5.1.8-database-injection.md`](./5.1.8-database-injection.md) | 5.1.8 (Data Validation and Sanitization) — Protect against database injection attacks |
| [`5.1.9-os-command-injection.md`](./5.1.9-os-command-injection.md) | 5.1.9 (Data Validation and Sanitization) — Protect against OS command injections |
| [`5.1.10-lfi-rfi.md`](./5.1.10-lfi-rfi.md) | 5.1.10 (Data Validation and Sanitization) — Protect against local/remote file inclusion |
| [`5.2.1-file-upload-security.md`](./5.2.1-file-upload-security.md) | 5.2.1 (Data Validation and Sanitization) — Securely handle untrusted files |
| [`6.1.1-dependency-vulnerabilities.md`](./6.1.1-dependency-vulnerabilities.md) | 6.1.1 (Configuration) — Keep all components up to date |
| [`6.2.1-debug-mode.md`](./6.2.1-debug-mode.md) | 6.2.1 (Configuration) — Disable debug modes in production environments |
| [`6.3.1-origin-header-auth.md`](./6.3.1-origin-header-auth.md) | 6.3.1 (Configuration) — Origin header shall not be used for access control decisions |
| [`6.4.1-subdomain-takeover.md`](./6.4.1-subdomain-takeover.md) | 6.4.1 (Configuration) — Protect application from subdomain takeover |
| [`6.5.1-credential-payment-logging.md`](./6.5.1-credential-payment-logging.md) | 6.5.1 (Configuration) — Do not log credentials or payment details |
| [`6.6.1-browser-storage-logout.md`](./6.6.1-browser-storage-logout.md) | 6.6.1 (Session Management) — Securely clear client storage during logout |
| [`6.7.1-secrets-management.md`](./6.7.1-secrets-management.md) | 6.7.1 (Configuration) — Securely store server-side secrets |
| [`F1-F5-findings-evidence-index.md`](./F1-F5-findings-evidence-index.md) | Findings/Evidence F1–F5 — maps evidence IDs to control docs and lab-only deliverables |

Add one file per control as we work through the questionnaire, named
`<control-id>-<short-slug>.md`.

## Conventions for each control file

- **Assessor prompt** quoted verbatim at the top.
- **Short answer** — the 2–3 sentence version that goes into the CASA portal.
- **Detailed response** — deliverable‑by‑deliverable, grounded in code with
  `path:line` citations so a reviewer can verify without a walkthrough.
- **Screenshot checklist** — what still has to be captured from a running instance,
  with an owner column. Screenshots are attached in the CASA portal, **not**
  committed here (they can contain environment URLs / test PII).
- **Verification date** and the commit / `better-auth` version the claims were
  checked against.

## Source of truth

The live questionnaire is tracked in the **CASA portal / assessor spreadsheet**
(outside this repo). These files are the working copy the team drafts and reviews
before pasting answers in.
