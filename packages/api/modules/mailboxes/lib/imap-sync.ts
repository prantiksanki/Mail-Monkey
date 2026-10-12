import {
	db,
	type EmailUpsertData,
	getMailboxSyncState,
	updateMailboxSyncState,
	upsertEmailsBatch,
} from "@repo/database";
import { logger } from "@repo/logs";
import { withImapConnection } from "./imap-client";
import { encodeMessageId } from "./imap-message-id";
import { isUnreadFromFlags, parseImapMessage } from "./imap-parser";
import { findSyncFolders, type SyncFolder } from "./imap-provider";

type SyncMailbox = { id: string; accountId: string; email: string };

// In-process set to prevent concurrent syncs for the same mailbox — mirrors
// outlook-sync.ts's guard.
const syncingMailboxes = new Set<string>();

/**
 * How many messages to pull the first time a non-inbox folder (Sent, Trash…)
 * is seen. The full historical sync only walked INBOX, so mailboxes that were
 * already "complete" never mirrored these folders.
 */
const FIRST_FOLDER_SYNC_LIMIT = 500;

async function fetchAndUpsert(
	mailbox: SyncMailbox,
	folder: SyncFolder,
	uids: number[],
): Promise<EmailUpsertData[]> {
	if (uids.length === 0) {
		return [];
	}
	return withImapConnection(mailbox.accountId, async (client) => {
		await client.mailboxOpen(folder.path, { readOnly: true });
		const emails: EmailUpsertData[] = [];
		for await (const message of client.fetch(
			uids,
			{ uid: true, flags: true, source: true },
			{ uid: true },
		)) {
			if (!message.source) {
				continue;
			}
			try {
				const parsed = await parseImapMessage({
					uid: message.uid,
					flags: message.flags ?? new Set(),
					source: message.source,
				});
				const id = encodeMessageId(folder.path, message.uid);
				emails.push({
					id,
					mailboxId: mailbox.id,
					threadId: parsed.threadId || id,
					from: parsed.from,
					fromEmail: parsed.fromEmail,
					to: parsed.to,
					subject: parsed.subject,
					snippet: parsed.snippet,
					bodyText: parsed.bodyText,
					bodyHtml: parsed.bodyHtml,
					labelIds: folder.label
						? [...parsed.labelIds, folder.label]
						: parsed.labelIds,
					isUnread: isUnreadFromFlags(message.flags ?? new Set()),
					internalDate: parsed.date,
				});
			} catch (parseError) {
				logger.warn("[imap-sync] Failed to parse message", {
					mailboxId: mailbox.id,
					uid: message.uid,
					error:
						parseError instanceof Error
							? parseError.message
							: String(parseError),
				});
			}
		}
		return emails;
	});
}

// Labels the server state decides on every sync: IMAP flags (see imap-parser
// FLAG_LABEL) and the system label of the folder the message sits in. Anything
// else on a stored row is a MailMonkey label (e.g. a rule's LABEL action) which
// the server knows nothing about and which must survive a re-sync.
const SERVER_LABELS = new Set([
	"SEEN",
	"STARRED",
	"ANSWERED",
	"INBOX",
	"SENT",
	"TRASH",
	"SPAM",
]);

/**
 * `upsertEmail` overwrites `labelIds` with whatever the sync parsed, which for
 * IMAP is only flags + folder — so a plain re-sync would erase labels applied
 * by rules. Carry the existing app labels over, and keep locally-snoozed mail
 * out of the inbox (snooze is local-only for IMAP, so the server still has the
 * message in INBOX).
 */
async function preserveAppState(
	emails: EmailUpsertData[],
): Promise<EmailUpsertData[]> {
	if (emails.length === 0) {
		return emails;
	}
	const ids = emails.map((e) => e.id);
	const [existing, snoozed] = await Promise.all([
		db.email.findMany({
			where: { id: { in: ids } },
			select: { id: true, labelIds: true },
		}),
		db.snoozedEmail.findMany({
			where: {
				mailboxId: emails[0].mailboxId,
				status: "SNOOZED",
				messageId: { in: ids },
			},
			select: { messageId: true },
		}),
	]);
	const appLabelsById = new Map(
		existing.map((row) => [
			row.id,
			row.labelIds.filter((l) => !SERVER_LABELS.has(l)),
		]),
	);
	const snoozedIds = new Set(snoozed.map((s) => s.messageId));
	return emails.map((email) => {
		const keep = appLabelsById.get(email.id) ?? [];
		let labelIds = [
			...email.labelIds,
			...keep.filter((l) => !email.labelIds.includes(l)),
		];
		if (snoozedIds.has(email.id)) {
			labelIds = labelIds.filter((l) => l !== "INBOX");
		}
		return { ...email, labelIds };
	});
}

async function listFolderUids(
	mailbox: SyncMailbox,
): Promise<Array<{ folder: SyncFolder; uidsAscending: number[] }>> {
	return withImapConnection(mailbox.accountId, async (client) => {
		const folders = await findSyncFolders(client);
		const result: Array<{ folder: SyncFolder; uidsAscending: number[] }> =
			[];
		for (const folder of folders) {
			try {
				await client.mailboxOpen(folder.path, { readOnly: true });
				const all = await client.search({ all: true }, { uid: true });
				result.push({
					folder,
					uidsAscending: [...(all || [])].sort((a, b) => a - b),
				});
			} catch (error) {
				// One unreadable folder must not stop the others from syncing.
				logger.warn("[imap-sync] Could not read folder", {
					mailboxId: mailbox.id,
					folder: folder.path,
					error:
						error instanceof Error ? error.message : String(error),
				});
			}
		}
		return result;
	});
}

/**
 * Makes sure rows synced before folder labels existed carry their folder's
 * label, so the inbox/sent views (which filter on it) see the whole history
 * rather than only what has been re-synced since.
 */
async function backfillFolderLabel(mailboxId: string, folder: SyncFolder) {
	if (!folder.label) {
		return;
	}
	await db.$executeRaw`UPDATE "email" SET "labelIds" = array_append("labelIds", ${folder.label}) WHERE "mailboxId" = ${mailboxId} AND starts_with("id", ${`${folder.path}:`}) AND NOT (${folder.label} = ANY("labelIds"))`;
}

/**
 * Drops rows for messages that no longer exist in the folder (deleted, moved
 * or archived elsewhere), so the local copy doesn't keep showing mail the
 * server no longer has. Skipped when the server reports an empty folder, as a
 * guard against an empty listing wiping the mirror.
 */
async function pruneRemoved(
	mailboxId: string,
	folder: SyncFolder,
	uidsAscending: number[],
) {
	if (uidsAscending.length === 0) {
		return;
	}
	const prefix = `${folder.path}:`;
	const present = new Set(
		uidsAscending.map((uid) => encodeMessageId(folder.path, uid)),
	);
	const rows = await db.email.findMany({
		where: { mailboxId, id: { startsWith: prefix } },
		select: { id: true },
	});
	const gone = rows.map((r) => r.id).filter((id) => !present.has(id));
	for (let i = 0; i < gone.length; i += 500) {
		await db.email.deleteMany({
			where: { mailboxId, id: { in: gone.slice(i, i + 500) } },
		});
	}
}

/**
 * Incremental sync: pull the most recent N messages (newest-first UIDs) of each
 * mirrored folder and upsert them into the DB. Called on the poll interval in
 * imap-sync-poller.ts — generic IMAP has no push/webhook equivalent to
 * Gmail's history API or Outlook's Graph subscriptions, so this is the only
 * way new mail ever reaches the local DB.
 */
export async function syncRecentImapEmails(
	mailbox: SyncMailbox,
	maxResults = 25,
	{ onlyNew = false }: { onlyNew?: boolean } = {},
): Promise<number> {
	const folders = await listFolderUids(mailbox);

	let synced = 0;
	for (const { folder, uidsAscending } of folders) {
		await backfillFolderLabel(mailbox.id, folder);
		const known = await db.email.count({
			where: {
				mailboxId: mailbox.id,
				id: { startsWith: `${folder.path}:` },
			},
		});
		const limit = known === 0 ? FIRST_FOLDER_SYNC_LIMIT : maxResults;
		let uids = [...uidsAscending].reverse().slice(0, limit);
		if (onlyNew && known > 0) {
			// Cheap refresh (used before AI answers): skip mail already stored
			// rather than re-downloading it just to re-read its flags.
			const stored = new Set(
				(
					await db.email.findMany({
						where: {
							mailboxId: mailbox.id,
							id: {
								in: uids.map((uid) =>
									encodeMessageId(folder.path, uid),
								),
							},
						},
						select: { id: true },
					})
				).map((r) => r.id),
			);
			uids = uids.filter(
				(uid) => !stored.has(encodeMessageId(folder.path, uid)),
			);
		}

		const emails = await fetchAndUpsert(mailbox, folder, uids);
		if (emails.length > 0) {
			await upsertEmailsBatch(await preserveAppState(emails));
		}
		await pruneRemoved(mailbox.id, folder, uidsAscending);
		synced += emails.length;
	}
	logger.info("[imap-sync] Incremental sync complete", {
		mailboxId: mailbox.id,
		synced,
	});
	return synced;
}

/**
 * Full historical sync, paged oldest-ward from the most recent message, one
 * folder at a time (Inbox first).
 */
export async function syncAllImapEmails(mailbox: SyncMailbox) {
	if (syncingMailboxes.has(mailbox.id)) {
		logger.info("[imap-sync] Sync already running for mailbox", {
			mailboxId: mailbox.id,
		});
		return;
	}
	syncingMailboxes.add(mailbox.id);
	try {
		await runFullSync(mailbox);
	} finally {
		syncingMailboxes.delete(mailbox.id);
	}
}

const PAGE_SIZE = 100;

async function runFullSync(mailbox: SyncMailbox) {
	const state = await getMailboxSyncState(mailbox.id);
	if (state?.emailSyncComplete) {
		logger.info("[imap-sync] Sync already complete for mailbox", {
			mailboxId: mailbox.id,
		});
		return;
	}

	logger.info("[imap-sync] Starting full email sync", {
		mailboxId: mailbox.id,
		email: mailbox.email,
	});

	const folders = await listFolderUids(mailbox);

	let totalSynced = 0;
	for (const { folder, uidsAscending } of folders) {
		await backfillFolderLabel(mailbox.id, folder);
		// Newest first, same order Gmail/Outlook sync walks in.
		const descending = [...uidsAscending].reverse();

		for (let i = 0; i < descending.length; i += PAGE_SIZE) {
			const page = descending.slice(i, i + PAGE_SIZE);
			const emails = await fetchAndUpsert(mailbox, folder, page);
			if (emails.length > 0) {
				await upsertEmailsBatch(await preserveAppState(emails));
				totalSynced += emails.length;
				const oldest = emails.reduce((min, e) =>
					e.internalDate < min.internalDate ? e : min,
				);
				await updateMailboxSyncState(mailbox.id, {
					emailSyncCursor: oldest.internalDate.toISOString(),
				});
			}
			logger.info("[imap-sync] Page complete", {
				mailboxId: mailbox.id,
				folder: folder.path,
				page: Math.floor(i / PAGE_SIZE) + 1,
				synced: emails.length,
				totalSynced,
			});
		}
		await pruneRemoved(mailbox.id, folder, uidsAscending);
	}

	await updateMailboxSyncState(mailbox.id, {
		emailSyncComplete: true,
		emailSyncCursor: null,
	});
	logger.info("[imap-sync] Full sync complete", {
		mailboxId: mailbox.id,
		totalSynced,
	});
}
