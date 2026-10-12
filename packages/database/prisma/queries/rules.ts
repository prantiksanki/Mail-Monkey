import { db } from "../client";

export async function getRulesByMailboxId({
	mailboxId,
}: {
	mailboxId: string;
}) {
	return await db.rule.findMany({
		where: {
			mailboxId,
		},
		orderBy: {
			createdAt: "desc",
		},
	});
}

export async function getRuleById(id: string) {
	return await db.rule.findUnique({
		where: {
			id,
		},
	});
}

/**
 * Finds a rule in the given mailbox whose name matches `name`
 * case-insensitively (after trimming). Used to enforce unique rule names
 * per mailbox. Pass `excludeId` to ignore a specific rule (e.g. when
 * renaming the rule being updated).
 */
export async function findRuleByNameInMailbox({
	mailboxId,
	name,
	excludeId,
}: {
	mailboxId: string;
	name: string;
	excludeId?: string;
}) {
	return await db.rule.findFirst({
		where: {
			mailboxId,
			name: {
				equals: name.trim(),
				mode: "insensitive",
			},
			...(excludeId && { id: { not: excludeId } }),
		},
	});
}

type LabelAction = { type?: string; fields?: { label?: string | null } };

/** Extracts the label name from a rule's LABEL action, if any. */
export function getRuleLabelName(actions: unknown): string | undefined {
	if (!Array.isArray(actions)) {
		return undefined;
	}
	const labelAction = (actions as LabelAction[]).find(
		(a) => a?.type === "LABEL" && a?.fields?.label,
	);
	const label = labelAction?.fields?.label;
	return typeof label === "string" ? label : undefined;
}

/**
 * Finds a rule in the given mailbox whose LABEL action targets `label`
 * (case-insensitive, trimmed). Used to enforce that one mailbox has at most one
 * label of a given name. Pass `excludeId` to ignore a rule (e.g. when updating
 * the rule being edited). Matched in JS because the label lives inside the
 * `actions` JSON, not a queryable column.
 */
export async function findRuleByLabelInMailbox({
	mailboxId,
	label,
	excludeId,
}: {
	mailboxId: string;
	label: string;
	excludeId?: string;
}) {
	const target = label.trim().toLowerCase();
	if (!target) {
		return null;
	}
	const rules = await db.rule.findMany({
		where: {
			mailboxId,
			...(excludeId && { id: { not: excludeId } }),
		},
	});
	return (
		rules.find(
			(r) => getRuleLabelName(r.actions)?.trim().toLowerCase() === target,
		) ?? null
	);
}

export async function createRule({
	mailboxId,
	name,
	condition,
	actions,
	enabled = true,
}: {
	mailboxId: string;
	name: string;
	condition: object;
	actions: Array<object>;
	enabled?: boolean;
}) {
	return await db.rule.create({
		data: {
			mailboxId,
			name,
			condition,
			actions,
			enabled,
		},
	});
}

export async function updateRule({
	id,
	name,
	condition,
	actions,
	enabled,
}: {
	id: string;
	name?: string;
	condition?: object;
	actions?: Array<object>;
	enabled?: boolean;
}) {
	return await db.rule.update({
		where: {
			id,
		},
		data: {
			...(name !== undefined && { name }),
			...(condition !== undefined && { condition }),
			...(actions !== undefined && { actions }),
			...(enabled !== undefined && { enabled }),
		},
	});
}

export async function deleteRule(id: string) {
	return await db.rule.delete({
		where: {
			id,
		},
	});
}

export async function toggleRuleEnabled({
	id,
	enabled,
}: {
	id: string;
	enabled: boolean;
}) {
	return await db.rule.update({
		where: {
			id,
		},
		data: {
			enabled,
		},
	});
}
