# Code Style

- Use TypeScript strictly — no `any` types unless absolutely necessary.
- Use functional components with hooks for all React code.
- Use `kebab-case` for file names, `PascalCase` for components, `camelCase` for functions and variables.
- Prefer named exports over default exports for utilities; use default exports for page components.
- Use Tailwind CSS for styling — avoid inline styles.
- Keep components small and single-responsibility.
- Use `shadcn/ui` primitives before building custom UI components.
- Group imports: external libs → internal packages → relative imports, separated by blank lines.
