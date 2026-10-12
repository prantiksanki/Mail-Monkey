import { logger } from "@repo/logs";
import { repositionDuePaymentCards } from "./payment-reposition";

const POLL_INTERVAL_MS = 60 * 60 * 1000; // hourly — pure date math, cheap to run often

declare global {
	var __paymentRepositionPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that re-derives each AUTOMATIC payment card's
 * Kanban column against today's date every hour, so a bill automatically
 * moves Upcoming -> Due Soon -> Overdue as its due date approaches/passes,
 * without needing a new email to trigger reclassification. Guarded via
 * globalThis so dev hot-reload doesn't stack multiple intervals — same
 * pattern as the other pollers in this module.
 */
export function startPaymentRepositionPoller() {
	if (globalThis.__paymentRepositionPoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await repositionDuePaymentCards();
			if (result.moved > 0) {
				logger.info(
					`Payment reposition: checked ${result.checked}, moved ${result.moved}`,
				);
			}
		} catch (error) {
			logger.error("Payment reposition poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	timer.unref?.();
	globalThis.__paymentRepositionPoller = timer;

	// Run once shortly after boot too, so a stale board updates promptly on
	// deploy/restart rather than waiting up to an hour for the first tick.
	setTimeout(tick, 10_000).unref?.();
}
