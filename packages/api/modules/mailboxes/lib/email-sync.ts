import {
	db,
	type EmailUpsertData,
	getMailboxSyncState,
	updateMailboxSyncState,
	upsertEmailsBatch,
} from "@repo/database";
import { logger } from "@repo/logs";
import { type GmailMessage, parseGmailMessage } from "./email-parser";
import { getMessage, listMessages } from "./gmail-client";

// In-process set to prevent concurrent syncs for the same mailbox
const syncingMailboxes = new Set<string>();

export async function syncAllEmails(mailbox: {
	id: string;
	accountId: string;
	email: string;
}) {
	if (syncingMailboxes.has(mailbox.id)) {
		logger.info("[email-sync] Sync already running for mailbox", {
			mailboxId: mailbox.id,
		});
		return;
	}

	syncingMailboxes.add(mailbox.id);

	try {
		await runSync(mailbox);
	} catch (error) {
		// Callers fire-and-forget this, so surface the failure here instead of
		// leaving it as a silent unhandled rejection.
		logger.error("[email-sync] Full sync failed", {
			mailboxId: mailbox.id,
			error: error instanceof Error ? error.message : String(error),
		});
	} finally {
		syncingMailboxes.delete(mailbox.id);
	}
}

/**
 * Incremental sync: pull the most recent N messages from Gmail (newest-first)
 * and upsert them into the DB. Unlike {@link syncAllEmails}, this ignores the
 * `emailSyncComplete` flag and always runs, so newly-arrived mail surfaces
 * immediately when the user refreshes — covering the gap when a webhook is
 * delayed or missed. Returns the number of messages upserted.
 */
export async function syncRecentEmails(
	mailbox: { id: string; accountId: string; email: string },
	maxResults = 25,
): Promise<number> {
	const listResult = await listMessages(mailbox.accountId, { maxResults });
	const ids = listResult.messages ?? [];
	if (ids.length === 0) {
		return 0;
	}

	const results = await Promise.allSettled(
		ids.map((m) =>
			m.id
				? getMessage(mailbox.accountId, m.id, "full")
				: Promise.reject(new Error("no id")),
		),
	);

	const emails: EmailUpsertData[] = [];
	for (const result of results) {
		if (result.status === "rejected") {
			continue;
		}
		try {
			const parsed = parseGmailMessage(result.value as GmailMessage);
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
				isUnread: parsed.labelIds.includes("UNREAD"),
				internalDate: parsed.date,
			});
		} catch (parseError) {
			logger.warn("[email-sync] Failed to parse message (incremental)", {
				error:
					parseError instanceof Error
						? parseError.message
						: String(parseError),
			});
		}
	}

	if (emails.length > 0) {
		await upsertEmailsBatch(emails);
	}

	logger.info("[email-sync] Incremental sync complete", {
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
		logger.info("[email-sync] Sync already complete for mailbox", {
			mailboxId: mailbox.id,
		});
		return;
	}

	logger.info("[email-sync] Starting full email sync", {
		mailboxId: mailbox.id,
		email: mailbox.email,
		resumingFrom: state?.emailSyncCursor ?? "beginning",
	});

	let pageToken: string | undefined;
	let totalSynced = 0;
	let page = 0;

	do {
		page++;
		logger.info("[email-sync] Fetching page", {
			mailboxId: mailbox.id,
			page,
			pageToken: pageToken ?? "first",
		});

		// Fetch a page of message IDs — no label filter means ALL mail
		const listResult = await listMessages(mailbox.accountId, {
			maxResults: 100,
			pageToken,
		});

		const listed = listResult.messages ?? [];
		if (listed.length === 0) {
			break;
		}

		// Skip messages already stored. The sync restarts from the newest page
		// after a server restart or failure, so without this every retry would
		// re-download (and re-bill quota for) everything it already imported.
		const existing = await db.email.findMany({
			where: {
				mailboxId: mailbox.id,
				id: { in: listed.flatMap((m) => (m.id ? [m.id] : [])) },
			},
			select: { id: true },
		});
		const existingIds = new Set(existing.map((e) => e.id));
		const ids = listed.filter((m) => !m.id || !existingIds.has(m.id));

		// Fetch full message details in parallel (batches of 10 to stay under quota)
		const BATCH = 10;
		const emails: EmailUpsertData[] = [];

		for (let i = 0; i < ids.length; i += BATCH) {
			const batchIds = ids.slice(i, i + BATCH);
			const results = await Promise.allSettled(
				batchIds.map((m) =>
					m.id
						? getMessage(mailbox.accountId, m.id, "full")
						: Promise.reject(new Error("no id")),
				),
			);

			for (const result of results) {
				if (result.status === "rejected") {
					continue;
				}
				try {
					const msg = result.value as GmailMessage;
					const parsed = parseGmailMessage(msg);
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
						isUnread: parsed.labelIds.includes("UNREAD"),
						internalDate: parsed.date,
					});
				} catch (parseError) {
					logger.warn("[email-sync] Failed to parse message", {
						error:
							parseError instanceof Error
								? parseError.message
								: String(parseError),
					});
				}
			}

			// Small delay between batches — Gmail quota: 250 units/s
			// getMessage("full") costs 5 units; 10 parallel = 50 units/batch
			await sleep(200);
		}

		// Batch upsert into DB
		if (emails.length > 0) {
			await upsertEmailsBatch(emails);
			totalSynced += emails.length;

			// Track cursor = oldest email date in this page (for resume on restart)
			const oldest = emails.reduce((min, e) =>
				e.internalDate < min.internalDate ? e : min,
			);
			await updateMailboxSyncState(mailbox.id, {
				emailSyncCursor: oldest.internalDate.toISOString(),
			});
		}

		pageToken = listResult.nextPageToken ?? undefined;

		logger.info("[email-sync] Page complete", {
			mailboxId: mailbox.id,
			page,
			synced: emails.length,
			totalSynced,
			hasMore: !!pageToken,
		});

		// Delay between pages to be kind to Gmail quota
		if (pageToken) {
			await sleep(500);
		}
	} while (pageToken);

	await updateMailboxSyncState(mailbox.id, {
		emailSyncComplete: true,
		emailSyncCursor: null,
	});

	logger.info("[email-sync] Full sync complete", {
		mailboxId: mailbox.id,
		totalSynced,
	});
}

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
