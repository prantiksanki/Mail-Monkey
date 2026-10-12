/**
 * Extracts the label names a rule's actions apply. `rule.actions` is stored as
 * Prisma `Json`, so it arrives untyped — this walks it defensively and returns
 * the trimmed, non-empty label strings from every `LABEL` action.
 */
export function labelNamesFromActions(actions: unknown): string[] {
	if (!Array.isArray(actions)) {
		return [];
	}
	const names: string[] = [];
	for (const action of actions) {
		if (
			action &&
			typeof action === "object" &&
			(action as { type?: unknown }).type === "LABEL"
		) {
			const label = (action as { fields?: { label?: unknown } }).fields
				?.label;
			if (typeof label === "string" && label.trim().length > 0) {
				names.push(label.trim());
			}
		}
	}
	return names;
}
