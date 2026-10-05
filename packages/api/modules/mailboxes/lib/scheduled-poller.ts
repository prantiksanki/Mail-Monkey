import { logger } from "@repo/logs";
import { processDueScheduledEmails } from "./scheduled-sender";

const POLL_INTERVAL_MS = 60_000;

declare global {
	var __scheduledEmailPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that sends due scheduled emails every minute.
 *
 * This makes scheduled send work without an external cron trigger — which is
 * essential in local development and serves as a fallback in environments that
 * don't run the `/internal/cron/send-scheduled` endpoint. The secured cron
 * endpoint remains the preferred trigger for serverless deployments where the
 * process is short-lived.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals.
 */
export function startScheduledEmailPoller() {
	if (globalThis.__scheduledEmailPoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await processDueScheduledEmails();
			if (result.processed > 0) {
				logger.info(
					`Scheduled emails: sent ${result.sent}, failed ${result.failed}`,
				);
			}
		} catch (error) {
			logger.error("Scheduled email poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	// Don't keep the process alive solely for this timer.
	timer.unref?.();
	globalThis.__scheduledEmailPoller = timer;

	// Run once shortly after start so due items don't wait a full interval.
	setTimeout(tick, 5_000).unref?.();
}
