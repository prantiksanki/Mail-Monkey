# Testing

- Write tests for all new API procedures using the project's test setup.
- Test files live alongside source files with `.test.ts` or `.spec.ts` suffix.
- Use real database connections for integration tests — do not mock the database.
- Unit test pure utility functions and helpers.
- Always test edge cases: empty input, missing fields, unauthorized access.
- Run `pnpm test` before marking any task complete.
