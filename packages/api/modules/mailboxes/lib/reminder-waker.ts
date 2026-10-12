import {
	createNotification,
	getDueReminders,
	markReminderFailed,
	markReminderFired,
} from "@repo/database";
import { logger } from "@repo/logs";

export interface ProcessRemindersResult {
	processed: number;
	fired: number;
	failed: number;
}

/**
 * Fires all reminders whose remind time has passed: creates a Notification for
 * the owning user and marks the reminder FIRED. Each is processed
 * independently — one failure never blocks the rest. Failed items stay
 * PENDING and retry on the next tick. Intended to run from a poller.
 */
export async function processDueReminders(
	now: Date = new Date(),
	limit = 50,
): Promise<ProcessRemindersResult> {
	const due = await getDueReminders(now, limit);

	let fired = 0;
	let failed = 0;

	for (const reminder of due) {
		try {
			await createNotification({
				userId: reminder.userId,
				type: "reminder",
				title: reminder.text,
				body: "Reminder due now",
			});
			await markReminderFired(reminder.id);
			fired++;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error("Failed to fire reminder", {
				reminderId: reminder.id,
				mailboxId: reminder.mailboxId,
				error: message,
			});
			await markReminderFailed(reminder.id, message);
			failed++;
		}
	}

	return { processed: due.length, fired, failed };
}
