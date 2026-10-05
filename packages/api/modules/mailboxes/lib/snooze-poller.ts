import { logger } from "@repo/logs";
import { processDueSnoozedEmails } from "./snooze-waker";

const POLL_INTERVAL_MS = 60_000;

declare global {
	var __snoozePoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that returns due snoozed emails to the inbox
 * every minute. Makes snooze work without an external cron trigger (essential
 * for local dev); the secured `/internal/cron/wake-snoozed` endpoint remains
 * the preferred trigger for serverless deployments.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals.
 */
export function startSnoozePoller() {
	if (globalThis.__snoozePoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await processDueSnoozedEmails();
			if (result.processed > 0) {
				logger.info(
					`Snoozed emails: returned ${result.returned}, failed ${result.failed}`,
				);
			}
		} catch (error) {
			logger.error("Snooze poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	// Don't keep the process alive solely for this timer.
	timer.unref?.();
	globalThis.__snoozePoller = timer;

	// Run once shortly after start so due items don't wait a full interval.
	setTimeout(tick, 5_000).unref?.();
}
