# /review

Review a branch or pull request for code quality, security, and correctness.

## Usage

```
/review <branch-name>
/review <PR-number>
```

## What this does

1. Compares the target branch against `main` (or `staging` if specified).
2. Reviews all changed files for:
   - Code style violations (see `.claude/rules/code-style.md`)
   - Security vulnerabilities (SQL injection, XSS, exposed secrets, OWASP top 10)
   - API convention violations (see `.claude/rules/api-conventions.md`)
   - Missing input validation or error handling at system boundaries
   - Type safety issues
3. Summarizes findings as:
   - **Blockers** — must fix before merging
   - **Warnings** — should fix but not blocking
   - **Suggestions** — optional improvements

## Example

```
/review feature/inbox-improvements
/review 42
```
