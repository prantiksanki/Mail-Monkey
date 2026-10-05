import { logger } from "@repo/logs";
import { renewExpiringWatches } from "./watch-manager";

const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

declare global {
	var __watchRenewalPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that renews Gmail/Outlook watch subscriptions
 * before they expire. Gmail watches lapse after 7 days and Outlook
 * subscriptions sooner; without renewal, push notifications silently stop and
 * new mail never syncs into the local DB.
 *
 * Runs in-process so renewal works regardless of whether an external scheduler
 * is wired up (the app is deployed on Azure App Service / Container Apps, where
 * the server is long-running). The secured `/internal/cron/renew-watches`
 * endpoint remains available as an alternative trigger.
 *
 * `renewExpiringWatches` only acts on watches within 24h of expiry, so polling
 * every few hours is cheap and gives ample margin to recover from a transient
 * failure before the watch actually lapses.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals.
 */
export function startWatchRenewalPoller() {
	if (globalThis.__watchRenewalPoller) {
		return;
	}

	const tick = async () => {
		try {
			await renewExpiringWatches();
		} catch (error) {
			logger.error("Watch renewal poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	// Don't keep the process alive solely for this timer.
	timer.unref?.();
	globalThis.__watchRenewalPoller = timer;

	// Run once shortly after start so a watch that already lapsed (e.g. server
	// was down past its expiry) gets re-registered without waiting a full cycle.
	setTimeout(tick, 10_000).unref?.();
}
