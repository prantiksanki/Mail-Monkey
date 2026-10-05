# API Conventions

- All API routes use oRPC procedures defined in `packages/api/modules/`.
- Use `protectedProcedure` for any route requiring authentication.
- Validate all inputs with Zod schemas before processing.
- Return consistent error shapes — throw `ORPCError` with appropriate codes.
- New router modules must be registered in the root router at `packages/api/orpc/router.ts`.
- Database access goes through the client imported from `@repo/database`.
- Never expose internal IDs or sensitive fields in API responses.
- Use `cursor`-based pagination for list endpoints.
