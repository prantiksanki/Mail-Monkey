import { db } from "../client";

export interface CreateScheduledEmailInput {
	mailboxId: string;
	to: string;
	cc?: string | null;
	bcc?: string | null;
	subject: string;
	body: string;
	scheduledAt: Date;
}

export async function createScheduledEmail(input: CreateScheduledEmailInput) {
	return db.scheduledEmail.create({
		data: {
			mailboxId: input.mailboxId,
			to: input.to,
			cc: input.cc ?? null,
			bcc: input.bcc ?? null,
			subject: input.subject,
			body: input.body,
			scheduledAt: input.scheduledAt,
		},
	});
}

/** Pending scheduled emails for a mailbox, soonest first. */
export async function getPendingScheduledEmails(mailboxId: string) {
	return db.scheduledEmail.findMany({
		where: { mailboxId, status: "PENDING" },
		orderBy: { scheduledAt: "asc" },
	});
}

export async function getScheduledEmailById(id: string) {
	return db.scheduledEmail.findUnique({ where: { id } });
}

/**
 * Pending scheduled emails whose time is due (scheduledAt <= now), oldest
 * first. Includes the mailbox so the sender can resolve the account. Used by
 * the cron worker; `limit` caps how many are processed per run.
 */
export async function getDueScheduledEmails(now: Date, limit = 50) {
	return db.scheduledEmail.findMany({
		where: { status: "PENDING", scheduledAt: { lte: now } },
		orderBy: { scheduledAt: "asc" },
		take: limit,
		include: { mailbox: true },
	});
}

export async function markScheduledEmailSent(
	id: string,
	messageId: string | null,
) {
	return db.scheduledEmail.update({
		where: { id },
		data: {
			status: "SENT",
			sentAt: new Date(),
			messageId,
			error: null,
			attempts: { increment: 1 },
		},
	});
}

export async function markScheduledEmailFailed(id: string, error: string) {
	return db.scheduledEmail.update({
		where: { id },
		data: {
			status: "FAILED",
			error: error.slice(0, 1000),
			attempts: { increment: 1 },
		},
	});
}

/**
 * Cancels a pending scheduled email. Only PENDING rows are affected, so a
 * message already sent or failed can't be retroactively canceled. Returns the
 * number of rows updated.
 */
export async function cancelScheduledEmail(id: string, mailboxId: string) {
	const result = await db.scheduledEmail.updateMany({
		where: { id, mailboxId, status: "PENDING" },
		data: { status: "CANCELED" },
	});
	return result.count;
}
