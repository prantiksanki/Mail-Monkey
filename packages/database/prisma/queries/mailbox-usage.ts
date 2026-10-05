import { db } from "../client";

/**
 * Get or create current month's usage tracking for a mailbox.
 * @param mailboxId - The ID of the mailbox
 * @returns The current usage tracking record
 */
export async function getOrCreateCurrentMailboxUsage(mailboxId: string) {
	const now = new Date();
	const periodStart = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
	const periodEnd = new Date(
		now.getFullYear(),
		now.getMonth() + 1,
		0,
		23,
		59,
		59,
		999,
	); // Last day of current month

	// Try to find existing record for this month
	let usage = await db.mailboxUsageTracking.findUnique({
		where: {
			mailboxId_periodStart: {
				mailboxId,
				periodStart,
			},
		},
	});

	// If not found, create a new record
	if (!usage) {
		usage = await db.mailboxUsageTracking.create({
			data: {
				mailboxId,
				periodStart,
				periodEnd,
				emailsProcessed: 0,
			},
		});
	}

	return usage;
}

/**
 * Increment the emails processed count for a mailbox.
 * @param mailboxId - The ID of the mailbox
 * @param count - The number to increment by (default: 1)
 * @returns The updated usage tracking record
 */
export async function incrementEmailsProcessed(mailboxId: string, count = 1) {
	const usage = await getOrCreateCurrentMailboxUsage(mailboxId);

	return await db.mailboxUsageTracking.update({
		where: {
			id: usage.id,
		},
		data: {
			emailsProcessed: {
				increment: count,
			},
		},
	});
}

/**
 * Get the current month's processed email count for a mailbox.
 * @param mailboxId - The ID of the mailbox
 * @returns The number of emails processed this month
 */
export async function getCurrentEmailsProcessed(mailboxId: string) {
	const usage = await getOrCreateCurrentMailboxUsage(mailboxId);
	return usage.emailsProcessed;
}
