import { db } from "../client";

export interface CreateSnoozedEmailInput {
	mailboxId: string;
	messageId: string;
	threadId?: string | null;
	from: string;
	subject: string;
	snippet: string;
	internalDate: Date;
	isUnread: boolean;
	originalLabelIds: string[];
	snoozeUntil: Date;
}

export async function createSnoozedEmail(input: CreateSnoozedEmailInput) {
	return db.snoozedEmail.create({
		data: {
			mailboxId: input.mailboxId,
			messageId: input.messageId,
			threadId: input.threadId ?? null,
			from: input.from,
			subject: input.subject,
			snippet: input.snippet,
			internalDate: input.internalDate,
			isUnread: input.isUnread,
			originalLabelIds: input.originalLabelIds,
			snoozeUntil: input.snoozeUntil,
		},
	});
}

/** Active (still-snoozed) emails for a mailbox, soonest wake first. */
export async function getActiveSnoozedEmails(mailboxId: string) {
	return db.snoozedEmail.findMany({
		where: { mailboxId, status: "SNOOZED" },
		orderBy: { snoozeUntil: "asc" },
	});
}

export async function getSnoozedEmailById(id: string) {
	return db.snoozedEmail.findUnique({ where: { id } });
}

/**
 * Snoozed emails whose wake time has passed (snoozeUntil <= now). Includes the
 * mailbox so the waker can resolve the Gmail account. Used by the poller/cron.
 */
export async function getDueSnoozedEmails(now: Date, limit = 50) {
	return db.snoozedEmail.findMany({
		where: { status: "SNOOZED", snoozeUntil: { lte: now } },
		orderBy: { snoozeUntil: "asc" },
		take: limit,
		include: { mailbox: true },
	});
}

export async function markSnoozeReturned(id: string) {
	return db.snoozedEmail.update({
		where: { id },
		data: {
			status: "RETURNED",
			returnedAt: new Date(),
			error: null,
			attempts: { increment: 1 },
		},
	});
}

/**
 * Records a failed wake attempt. The row stays SNOOZED so the next poller tick
 * retries it; `attempts` lets callers cap retries if needed.
 */
export async function markSnoozeFailed(id: string, error: string) {
	return db.snoozedEmail.update({
		where: { id },
		data: {
			error: error.slice(0, 1000),
			attempts: { increment: 1 },
		},
	});
}

/**
 * Marks a still-snoozed email CANCELED. Only SNOOZED rows are affected.
 * Returns the number of rows updated.
 */
export async function cancelSnoozedEmail(id: string, mailboxId: string) {
	const result = await db.snoozedEmail.updateMany({
		where: { id, mailboxId, status: "SNOOZED" },
		data: { status: "CANCELED" },
	});
	return result.count;
}
