import { db } from "../client";

export interface CreateReminderInput {
	mailboxId: string;
	userId: string;
	text: string;
	remindAt: Date;
}

export async function createReminder(input: CreateReminderInput) {
	return db.reminder.create({
		data: {
			mailboxId: input.mailboxId,
			userId: input.userId,
			text: input.text,
			remindAt: input.remindAt,
		},
	});
}

/** Active (still-pending) reminders for a mailbox, soonest first. */
export async function getActiveReminders(mailboxId: string) {
	return db.reminder.findMany({
		where: { mailboxId, status: "PENDING" },
		orderBy: { remindAt: "asc" },
	});
}

export async function getReminderById(id: string) {
	return db.reminder.findUnique({ where: { id } });
}

/**
 * Reminders whose remind time has passed (remindAt <= now). Includes the
 * mailbox so the waker has the owning user available. Used by the poller.
 */
export async function getDueReminders(now: Date, limit = 50) {
	return db.reminder.findMany({
		where: { status: "PENDING", remindAt: { lte: now } },
		orderBy: { remindAt: "asc" },
		take: limit,
		include: { mailbox: true },
	});
}

export async function markReminderFired(id: string) {
	return db.reminder.update({
		where: { id },
		data: {
			status: "FIRED",
			firedAt: new Date(),
			error: null,
		},
	});
}

/**
 * Records a failed fire attempt. The row stays PENDING so the next poller
 * tick retries it; `attempts` lets callers cap retries if needed.
 */
export async function markReminderFailed(id: string, error: string) {
	return db.reminder.update({
		where: { id },
		data: {
			error: error.slice(0, 1000),
			attempts: { increment: 1 },
		},
	});
}

/**
 * Marks a still-pending reminder CANCELED. Only PENDING rows are affected.
 * Returns the number of rows updated.
 */
export async function cancelReminder(id: string, mailboxId: string) {
	const result = await db.reminder.updateMany({
		where: { id, mailboxId, status: "PENDING" },
		data: { status: "CANCELED" },
	});
	return result.count;
}
