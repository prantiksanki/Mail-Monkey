import { getImapMailboxes } from "@repo/database";
import { logger } from "@repo/logs";
//import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import { syncRecentImapEmails } from "./imap-sync";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

declare global {
	var __imapSyncPoller: NodeJS.Timeout | undefined;
}

/**
 * Starts an in-process poller that pulls recent mail for every connected
 * IMAP/SMTP mailbox. Generic IMAP has no webhook/push equivalent to Gmail's
 * history API or Outlook's Graph subscriptions (see watch-renewal-poller.ts
 * for that side of the other two providers) — polling is the only way new
 * mail reaches the local DB for these mailboxes.
 *
 * Runs in-process for the same reason as the other pollers in this file's
 * sibling modules: the app is deployed long-running on Azure App Service /
 * Container Apps, not serverless, so a setInterval here works without an
 * external scheduler.
 *
 * Guarded via globalThis so dev hot-reload doesn't stack multiple intervals.
 */
export function startImapSyncPoller() {
	if (globalThis.__imapSyncPoller) {
		return;
	}

	const tick = async () => {
		let mailboxes: Array<{
			id: string;
			accountId: string;
			email: string;
			userId: string;
		}>;
		try {
			mailboxes = await getImapMailboxes();
		} catch (error) {
			logger.error("[imap-sync-poller] Failed to list IMAP mailboxes", {
				error: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		// Don't keep syncing mail for accounts with no active plan (no trial, or
		// an expired one) — they're locked out of the app, so every IMAP login
		// would be wasted. One plan lookup per user per tick.
		// const planByUser = new Map<string, boolean>();
		// const active: typeof mailboxes = [];
		// for (const mailbox of mailboxes) {
		// 	let hasPlan = planByUser.get(mailbox.userId);
		// 	if (hasPlan === undefined) {
		// 		try {
		// 			hasPlan =
		// 				(await resolveUserPlan(mailbox.userId)) !== "free";
		// 		} catch {
		// 			// If the plan can't be resolved, keep syncing rather than
		// 			// silently stopping mail for a paying user.
		// 			hasPlan = true;
		// 		}
		// 		planByUser.set(mailbox.userId, hasPlan);
		// 	}
		// 	if (hasPlan) {
		// 		active.push(mailbox);
		// 	}
		// }
		// mailboxes = active;

		// Isolate failures per mailbox — one bad IMAP account (expired
		// password, host down) must not block the rest from syncing.
		const results = await Promise.allSettled(
			mailboxes.map((mailbox) => syncRecentImapEmails(mailbox)),
		);
		for (let i = 0; i < results.length; i++) {
			const result = results[i];
			if (result.status === "rejected") {
				logger.warn("[imap-sync-poller] Sync failed for mailbox", {
					mailboxId: mailboxes[i].id,
					error:
						result.reason instanceof Error
							? result.reason.message
							: String(result.reason),
				});
			}
		}
	};

	const timer = setInterval(tick, POLL_INTERVAL_MS);
	// Don't keep the process alive solely for this timer.
	timer.unref?.();
	globalThis.__imapSyncPoller = timer;

	// Run once shortly after start so mail that arrived while the server was
	// down syncs without waiting a full interval.
	setTimeout(tick, 10_000).unref?.();
}
