import { logger } from "@repo/logs";
import { processDuePaymentScans } from "./payment-scan-backfill";

const POLL_INTERVAL_MS = 60_000;

declare global {
	var __paymentScanPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that scans newly-synced emails for payment/bill
 * relevance every minute, keeping the Payments Kanban board current without
 * adding a synchronous Gemini call to any sync/webhook call site. Guarded via
 * globalThis so dev hot-reload doesn't stack multiple intervals — same
 * pattern as email-classification-poller.ts.
 */
export function startPaymentScanPoller() {
	if (globalThis.__paymentScanPoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await processDuePaymentScans();
			if (result.cardsCreated > 0 || result.errors > 0) {
				logger.info(
					`Payment scan: scanned ${result.scanned}, cards created ${result.cardsCreated}, errors ${result.errors}`,
				);
			}
		} catch (error) {
			logger.error("Payment scan poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	timer.unref?.();
	globalThis.__paymentScanPoller = timer;

	setTimeout(tick, 5_000).unref?.();
}
