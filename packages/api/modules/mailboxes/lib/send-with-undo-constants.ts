/**
 * Grace window before a "sent" email actually goes out, so Undo can cancel
 * it. Split into its own zero-dependency module so client components can
 * import it without pulling in `@repo/database` (and its Node-only `pg`
 * driver) into the browser bundle.
 */
export const UNDO_SEND_WINDOW_MS = 10_000;
