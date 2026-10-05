# /deploy

Prepare and validate the project for deployment.

## Usage

```
/deploy [staging|production]
```

## What this does

1. Runs `pnpm build` to catch any build errors.
2. Checks for missing environment variables required for the target environment.
3. Verifies database migrations are up to date.
4. Confirms no console errors or TypeScript errors remain.
5. Creates a deployment checklist summary.

## Default target

If no target is specified, defaults to `staging`.
