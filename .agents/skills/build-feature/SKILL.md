---
name: build-feature
description: Build a complete feature from database to UI in this supastarter codebase. Use when creating new features, adding CRUD functionality, building widgets, or implementing end-to-end features that touch the database, API, and frontend layers.
argument-hint: [feature-description]
---

# Build a Complete Feature

Build features following the supastarter pattern: Database -> Queries -> API -> Frontend -> Translations -> Integration.

For a detailed example walkthrough, see [example-feedback-widget.md](example-feedback-widget.md).

## Step-by-step process

### Step 1: Database Schema

Add a Prisma model in `packages/database/prisma/schema.prisma`:

- Use `@id @default(cuid())` for IDs
- Add `createdAt DateTime @default(now())` and `updatedAt DateTime @updatedAt`
- Use `@@map("table_name")` for snake_case table names
- Add relations to existing models (e.g., User) where needed
- Run `pnpm --filter @repo/database prisma:generate` after schema changes

### Step 2: Database Queries

Create query functions in `packages/database/prisma/queries/<feature>.ts`:

- Import `db` from `../client`
- Create focused query functions (create, list, getById, update, delete)
- Export from `packages/database/prisma/queries/index.ts`

### Step 3: API Types & Validation

Create Zod schemas in `packages/api/modules/<feature>/types.ts`:

- Define input validation schemas with appropriate constraints
- Export the inferred TypeScript types alongside schemas
- Reuse these schemas in both API and frontend

### Step 4: API Procedures

Create oRPC procedures in `packages/api/modules/<feature>/procedures/<action>.ts`:

- Use `publicProcedure` for unauthenticated access
- Use `protectedProcedure` for authenticated access
- Use `adminProcedure` for admin-only access
- Include `.route()` with method, path, tags, summary
- Add `.input()` with Zod schema and `.output()` with response schema
- Import query functions from `@repo/database`
- Handle errors with `ORPCError`

Create the router in `packages/api/modules/<feature>/router.ts`:

```typescript
import { someProcedure } from "./procedures/some-action";
export const featureRouter = { someAction: someProcedure };
```

Mount in `packages/api/orpc/router.ts`:

```typescript
import { featureRouter } from "../modules/<feature>/router";
// Add to the router: feature: featureRouter
```

### Step 5: Frontend Component

Create the component in `apps/web/modules/shared/components/` or `apps/web/modules/saas/`:

- Add `"use client"` only if interactive
- Use `react-hook-form` + `zodResolver` for forms
- Use `useMutation`/`useQuery` with `orpc.<feature>.<action>.mutationOptions()`
- Use Shadcn UI components from `@repo/ui/components`
- Use `useTranslations()` for all user-facing strings
- Use `useSession()` for auth-aware UI
- Use `toast` from `sonner` for success/error feedback

### Step 6: Translations

Add translation keys in `packages/i18n/translations/en.json` (and other locale files):

- Nest under the feature name: `"feature": { "button": "...", "form": { ... } }`
- Include labels, placeholders, success/error messages

### Step 7: Integration

Add the component to the appropriate layout or page in `apps/web/app/`.

## Key conventions

- Import via package aliases: `@repo/*`, `@shared/*`, `@saas/*`
- Use interfaces over type aliases for object shapes
- Use named exports, no default exports
- Use `cn()` from `@repo/ui` for conditional classNames
- Follow mobile-first responsive design with Tailwind

## Feature: $ARGUMENTS
