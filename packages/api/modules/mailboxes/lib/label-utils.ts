/** Gmail system labels — never shown as user-facing chips. */
export const SYSTEM_LABELS = new Set([
	"INBOX",
	"UNREAD",
	"SENT",
	"DRAFT",
	"TRASH",
	"SPAM",
	"STARRED",
	"IMPORTANT",
]);

/**
 * Returns true for labels that should be shown as user-facing chips.
 * Keeps both proper Gmail user-label IDs ("Label_xxx") AND plain label names
 * stored directly by the rule action-executor (e.g. "Newsletter", "Finance").
 */
export function isUserLabel(id: string): boolean {
	return (
		id.startsWith("Label_") ||
		(!SYSTEM_LABELS.has(id) && !id.startsWith("CATEGORY_"))
	);
}
