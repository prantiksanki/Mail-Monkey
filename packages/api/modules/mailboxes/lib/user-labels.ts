import { countEmailsByLabel, getRulesByMailboxId } from "@repo/database";
import { resolveLabelNameToId } from "./label-resolver";
import { labelNamesFromActions } from "./rule-labels";

export interface UserLabel {
	name: string;
	count: number;
}

/**
 * Returns the mailbox's user labels (name + email count), derived from the
 * mailbox's rules' LABEL actions — the same source the sidebar uses. Counts
 * match both the label name and its resolved Gmail label ID, because emails
 * synced from Gmail store the opaque ID (e.g. "Label_21"), not the display name.
 *
 * Shared by the label-counts endpoint and the inbox assistant so both agree on
 * what labels exist and how many emails each holds.
 */
export async function getUserLabelsWithCounts(mailbox: {
	id: string;
	accountId: string;
	provider: string;
}): Promise<UserLabel[]> {
	const rules = await getRulesByMailboxId({ mailboxId: mailbox.id });

	// One entry per label name (case-insensitive), mirroring the sidebar's dedupe.
	const labelNames: string[] = [];
	const seen = new Set<string>();
	for (const rule of rules) {
		for (const name of labelNamesFromActions(rule.actions)) {
			const key = name.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				labelNames.push(name);
			}
		}
	}

	const labels: UserLabel[] = [];
	for (const name of labelNames) {
		const matchValues = [name];
		if (mailbox.provider === "GOOGLE") {
			const id = await resolveLabelNameToId(mailbox.accountId, name);
			if (id) {
				matchValues.push(id);
			}
		}
		labels.push({
			name,
			count: await countEmailsByLabel(mailbox.id, matchValues),
		});
	}
	return labels;
}
