import { logger } from "@repo/logs";
import { processDueEmailClassification } from "./email-classification-backfill";

const POLL_INTERVAL_MS = 60_000;

declare global {
	var __emailClassificationPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that classifies newly-synced, uncategorized
 * emails every minute — keeps the Dashboard's Inbox Overview category
 * breakdown current without adding a synchronous Gemini call to any of the
 * webhook/sync call sites that insert new Email rows. The client-driven
 * classification backfill (email-classification-backfill.ts start/advance)
 * handles the initial large-backlog catch-up on a freshly-synced mailbox;
 * this poller handles everything after that, indefinitely, with no browser
 * tab required.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals —
 * same pattern as scheduled-poller.ts.
 */
export function startEmailClassificationPoller() {
	if (globalThis.__emailClassificationPoller) {
		return;
	}

	const tick = async () => {
		try {
			const result = await processDueEmailClassification();
			if (result.classified > 0 || result.errors > 0) {
				logger.info(
					`Email classification: classified ${result.classified}, errors ${result.errors}`,
				);
			}
		} catch (error) {
			logger.error("Email classification poller failed", {
				error: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	timer.unref?.();
	globalThis.__emailClassificationPoller = timer;

	setTimeout(tick, 5_000).unref?.();
}
