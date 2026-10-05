# /fix-issue

Fix a reported bug or issue by finding the root cause and applying a minimal, targeted fix.

## Usage

```
/fix-issue <description or issue number>
```

## What this does

1. Searches the codebase for the source of the problem.
2. Applies the smallest possible fix — no refactoring beyond what's needed.
3. Verifies the fix doesn't break existing behavior.
4. Summarizes what was changed and why.
