import {
	type EmailUpsertData,
	getMailboxSyncState,
	updateMailboxSyncState,
	upsertEmailsBatch,
} from "@repo/database";
import { logger } from "@repo/logs";
import { getOutlookMessage, listOutlookInboxMessages } from "./outlook-client";
import { parseOutlookMessage } from "./outlook-parser";

// In-process set to prevent concurrent syncs for the same mailbox — mirrors
// email-sync.ts's guard (separate Set since mailboxIds don't collide across
// providers, but kept independent for clarity).
const syncingMailboxes = new Set<string>();

export function extractSkipToken(nextLink?: string): string | undefined {
	if (!nextLink) {
		return undefined;
	}
	const match = nextLink.match(/\$skipToken=([^&]+)/);
	return match ? decodeURIComponent(match[1]) : undefined;
}

export async function syncAllOutlookEmails(mailbox: {
	id: string;
	accountId: string;
	email: string;
}) {
	if (syncingMailboxes.has(mailbox.id)) {
		logger.info("[outlook-sync] Sync already running for mailbox", {
			mailboxId: mailbox.id,
		});
		return;
	}

	syncingMailboxes.add(mailbox.id);

	try {
		await runSync(mailbox);
	} finally {
		syncingMailboxes.delete(mailbox.id);
	}
}

/**
 * Incremental sync: pull the most recent N inbox messages from Outlook
 * (newest-first) and upsert them into the DB. Mirrors email-sync.ts's
 * syncRecentEmails — ignores emailSyncComplete, always runs, covers the gap
 * when a Graph change notification is delayed or missed.
 */
export async function syncRecentOutlookEmails(
	mailbox: { id: string; accountId: string; email: string },
	maxResults = 25,
): Promise<number> {
	const listResult = await listOutlookInboxMessages(mailbox.accountId, {
		maxResults,
	});
	const ids = listResult.value ?? [];
	if (ids.length === 0) {
		return 0;
	}

	const results = await Promise.allSettled(
		ids.map((m) => getOutlookMessage(mailbox.accountId, m.id)),
	);

	const emails: EmailUpsertData[] = [];
	for (const result of results) {
		if (result.status === "rejected") {
			continue;
		}
		try {
			const parsed = parseOutlookMessage(result.value);
			emails.push({
				id: parsed.id,
				mailboxId: mailbox.id,
				threadId: parsed.threadId,
				from: parsed.from,
				fromEmail: parsed.fromEmail,
				to: parsed.to,
				subject: parsed.subject,
				snippet: parsed.snippet,
				bodyText: parsed.bodyText,
				bodyHtml: parsed.bodyHtml,
				labelIds: parsed.labelIds,
				isUnread: !result.value.isRead,
				internalDate: parsed.date,
			});
		} catch (parseError) {
			logger.warn(
				"[outlook-sync] Failed to parse message (incremental)",
				{
					error:
						parseError instanceof Error
							? parseError.message
							: String(parseError),
				},
			);
		}
	}

	if (emails.length > 0) {
		await upsertEmailsBatch(emails);
	}

	logger.info("[outlook-sync] Incremental sync complete", {
		mailboxId: mailbox.id,
		synced: emails.length,
	});

	return emails.length;
}

async function runSync(mailbox: {
	id: string;
	accountId: string;
	email: string;
}) {
	const state = await getMailboxSyncState(mailbox.id);

	if (state?.emailSyncComplete) {
		logger.info("[outlook-sync] Sync already complete for mailbox", {
			mailboxId: mailbox.id,
		});
		return;
	}

	logger.info("[outlook-sync] Starting full email sync", {
		mailboxId: mailbox.id,
		email: mailbox.email,
		resumingFrom: state?.emailSyncCursor ?? "beginning",
	});

	let skipToken: string | undefined;
	let totalSynced = 0;
	let page = 0;

	do {
		page++;
		logger.info("[outlook-sync] Fetching page", {
			mailboxId: mailbox.id,
			page,
			skipToken: skipToken ?? "first",
		});

		// Inbox-only for v1 — no all-mail equivalent to Gmail's unfiltered
		// listMessages exists in this codebase yet (see plan doc).
		const listResult = await listOutlookInboxMessages(mailbox.accountId, {
			maxResults: 100,
			skipToken,
		});

		const ids = listResult.value ?? [];
		if (ids.length === 0) {
			break;
		}

		// Fetch full message details in parallel (batches of 10, paced —
		// Graph doesn't publish a fixed quota-unit model like Gmail's, so this
		// mirrors Gmail's pacing conservatively rather than guessing tighter).
		const BATCH = 10;
		const emails: EmailUpsertData[] = [];

		for (let i = 0; i < ids.length; i += BATCH) {
			const batchIds = ids.slice(i, i + BATCH);
			const results = await Promise.allSettled(
				batchIds.map((m) => getOutlookMessage(mailbox.accountId, m.id)),
			);

			for (const result of results) {
				if (result.status === "rejected") {
					continue;
				}
				try {
					const msg = result.value;
					const parsed = parseOutlookMessage(msg);
					emails.push({
						id: parsed.id,
						mailboxId: mailbox.id,
						threadId: parsed.threadId,
						from: parsed.from,
						fromEmail: parsed.fromEmail,
						to: parsed.to,
						subject: parsed.subject,
						snippet: parsed.snippet,
						bodyText: parsed.bodyText,
						bodyHtml: parsed.bodyHtml,
						labelIds: parsed.labelIds,
						isUnread: !msg.isRead,
						internalDate: parsed.date,
					});
				} catch (parseError) {
					logger.warn("[outlook-sync] Failed to parse message", {
						error:
							parseError instanceof Error
								? parseError.message
								: String(parseError),
					});
				}
			}

			await sleep(150);
		}

		if (emails.length > 0) {
			await upsertEmailsBatch(emails);
			totalSynced += emails.length;

			const oldest = emails.reduce((min, e) =>
				e.internalDate < min.internalDate ? e : min,
			);
			await updateMailboxSyncState(mailbox.id, {
				emailSyncCursor: oldest.internalDate.toISOString(),
			});
		}

		skipToken = extractSkipToken(listResult["@odata.nextLink"]);

		logger.info("[outlook-sync] Page complete", {
			mailboxId: mailbox.id,
			page,
			synced: emails.length,
			totalSynced,
			hasMore: !!skipToken,
		});

		if (skipToken) {
			await sleep(400);
		}
	} while (skipToken);

	await updateMailboxSyncState(mailbox.id, {
		emailSyncComplete: true,
		emailSyncCursor: null,
	});

	logger.info("[outlook-sync] Full sync complete", {
		mailboxId: mailbox.id,
		totalSynced,
	});
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
