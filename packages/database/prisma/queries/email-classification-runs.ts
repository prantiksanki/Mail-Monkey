import { db } from "../client";

const ACTIVE_CLASSIFICATION_STATUSES = ["pending", "running"] as const;

interface CreateEmailClassificationRunInput {
	mailboxId: string;
	status: string;
	totalAtStart?: number;
}

interface UpdateEmailClassificationRunInput {
	id: string;
	status?: string;
	cursor?: string | null;
	processedCount?: number;
	classifiedCount?: number;
	errorCount?: number;
	lastError?: string | null;
	completedAt?: Date | null;
}

export async function createEmailClassificationRun(
	input: CreateEmailClassificationRunInput,
) {
	return db.emailClassificationRun.create({
		data: input,
	});
}

export async function getEmailClassificationRunById(id: string) {
	return db.emailClassificationRun.findUnique({
		where: { id },
		include: { mailbox: true },
	});
}

export async function getActiveEmailClassificationRun(mailboxId: string) {
	return db.emailClassificationRun.findFirst({
		where: {
			mailboxId,
			status: { in: [...ACTIVE_CLASSIFICATION_STATUSES] },
		},
		orderBy: { createdAt: "desc" },
	});
}

export async function getLatestEmailClassificationRun(mailboxId: string) {
	return db.emailClassificationRun.findFirst({
		where: { mailboxId },
		orderBy: { createdAt: "desc" },
	});
}

export async function updateEmailClassificationRun(
	input: UpdateEmailClassificationRunInput,
) {
	const { id, ...data } = input;
	return db.emailClassificationRun.update({
		where: { id },
		data,
	});
}

/** Ordered oldest-cursor-first so a run makes steady forward progress across advances. */
export async function getUncategorizedEmails(
	mailboxId: string,
	opts: { cursor?: string; limit: number },
) {
	return db.email.findMany({
		where: {
			mailboxId,
			category: null,
			...(opts.cursor
				? { internalDate: { lt: new Date(opts.cursor) } }
				: {}),
		},
		orderBy: { internalDate: "desc" },
		take: opts.limit,
	});
}

export async function countUncategorizedEmails(
	mailboxId: string,
): Promise<number> {
	return db.email.count({
		where: { mailboxId, category: null },
	});
}

/** Distinct mailboxIds with at least one uncategorized email — for the poller. */
export async function getMailboxIdsWithUncategorizedEmails(
	limit: number,
): Promise<string[]> {
	const rows = await db.email.findMany({
		where: { category: null },
		distinct: ["mailboxId"],
		select: { mailboxId: true },
		take: limit,
	});
	return rows.map((r) => r.mailboxId);
}
