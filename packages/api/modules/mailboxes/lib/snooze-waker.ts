import {
	getDueSnoozedEmails,
	getEmailById,
	markSnoozeFailed,
	markSnoozeReturned,
	updateEmailLabels,
} from "@repo/database";
import { logger } from "@repo/logs";
import { modifyMessageLabels } from "./gmail-client";

export interface ProcessSnoozedResult {
	processed: number;
	returned: number;
	failed: number;
}

/**
 * Returns a snoozed email to the inbox: re-adds INBOX (and UNREAD so it
 * surfaces at the top, like Gmail) in Gmail, and restores the local Email
 * row's labels so it reappears in the DB-served inbox immediately.
 */
export async function restoreSnoozedToInbox(snooze: {
	mailboxId: string;
	messageId: string;
	originalLabelIds: string[];
	mailbox: { accountId: string; provider?: string };
}) {
	// IMAP has no server-side label to flip: snooze is local-only there (the
	// message never leaves the server's INBOX), so only the local copy changes.
	if (snooze.mailbox.provider !== "IMAP") {
		await modifyMessageLabels(
			snooze.mailbox.accountId,
			snooze.messageId,
			["INBOX", "UNREAD"],
			[],
		);
	}

	const localEmail = await getEmailById(snooze.mailboxId, snooze.messageId);
	if (localEmail) {
		const restored = Array.from(
			new Set([...snooze.originalLabelIds, "INBOX", "UNREAD"]),
		);
		await updateEmailLabels(snooze.messageId, restored);
	}
}

/**
 * Returns all snoozed emails whose wake time has passed. Each is processed
 * independently — one failure never blocks the rest. Failed items stay
 * SNOOZED and retry on the next tick. Intended to run from a cron/poller.
 */
export async function processDueSnoozedEmails(
	now: Date = new Date(),
	limit = 50,
): Promise<ProcessSnoozedResult> {
	const due = await getDueSnoozedEmails(now, limit);

	let returned = 0;
	let failed = 0;

	for (const snooze of due) {
		try {
			await restoreSnoozedToInbox(snooze);
			await markSnoozeReturned(snooze.id);
			returned++;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error("Failed to wake snoozed email", {
				snoozedEmailId: snooze.id,
				mailboxId: snooze.mailboxId,
				error: message,
			});
			await markSnoozeFailed(snooze.id, message);
			failed++;
		}
	}

	return { processed: due.length, returned, failed };
}
