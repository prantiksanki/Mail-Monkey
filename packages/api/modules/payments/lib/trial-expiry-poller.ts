import { logger } from "@repo/logs";
import { expireDueTrials } from "./expire-trials";

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly

declare global {
	var __trialExpiryPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that downgrades expired Pro trials hourly.
 *
 * Mirrors the scheduled-email/snooze pollers: this makes trial expiry work
 * without an external cron trigger (essential for local dev and a fallback in
 * environments that don't call `/internal/cron/expire-trials`). The secured
 * cron endpoint remains the preferred trigger for serverless deployments.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals.
 */
export function startTrialExpiryPoller() {
	if (globalThis.__trialExpiryPoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await expireDueTrials();
			if (result.expired > 0) {
				logger.info(`Trials expired: ${result.expired}`);
			}
		} catch (error) {
			logger.error("Trial expiry poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	// Don't keep the process alive solely for this timer.
	timer.unref?.();
	globalThis.__trialExpiryPoller = timer;

	// Run once shortly after start so already-due trials don't wait a full hour.
	setTimeout(tick, 5_000).unref?.();
}
