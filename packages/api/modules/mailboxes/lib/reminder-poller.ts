import { logger } from "@repo/logs";
import { processDueReminders } from "./reminder-waker";

const POLL_INTERVAL_MS = 60_000;

declare global {
	var __reminderPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that fires due reminders every minute. Mirrors
 * startSnoozePoller — makes reminders work without an external cron trigger.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals.
 */
export function startReminderPoller() {
	if (globalThis.__reminderPoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await processDueReminders();
			if (result.processed > 0) {
				logger.info(
					`Reminders: fired ${result.fired}, failed ${result.failed}`,
				);
			}
		} catch (error) {
			logger.error("Reminder poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	// Don't keep the process alive solely for this timer.
	timer.unref?.();
	globalThis.__reminderPoller = timer;

	// Run once shortly after start so due items don't wait a full interval.
	setTimeout(tick, 5_000).unref?.();
}
