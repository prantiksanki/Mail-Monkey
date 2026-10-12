import { db } from "../client";

export type EmailUpsertData = {
	id: string;
	mailboxId: string;
	threadId: string;
	from: string;
	fromEmail: string;
	to: string;
	subject: string;
	snippet: string;
	bodyText: string;
	bodyHtml: string;
	labelIds: string[];
	isUnread: boolean;
	internalDate: Date;
};

const FOLDER_LABEL: Record<string, string | undefined> = {
	inbox: "INBOX",
	sent: "SENT",
	drafts: "DRAFT",
	trash: "TRASH",
	spam: "SPAM",
};

// Gmail/Outlook system labels that are never user-applied. Mirrors
// `isUserLabel` in packages/api/.../label-utils.ts (kept local so this package
// stays dependency-free).
const SYSTEM_LABELS = new Set([
	"INBOX",
	"UNREAD",
	"SENT",
	"DRAFT",
	"TRASH",
	"SPAM",
	"STARRED",
	"IMPORTANT",
]);

/** True for labels a user/rule applied (vs Gmail/Outlook system labels). */
function isUserLabel(id: string): boolean {
	return (
		id.startsWith("Label_") ||
		(!SYSTEM_LABELS.has(id) && !id.startsWith("CATEGORY_"))
	);
}

/**
 * Turns a free-text query into per-word Prisma clauses to AND together: every
 * word must appear somewhere (AND across words), but each word may land in a
 * different field (OR across from/fromEmail/subject/snippet/bodyText). This
 * matches how people — and the AI assistant — phrase searches: e.g. "Google
 * security alerts" finds an email whose sender is "Google …" and whose subject
 * is "Security alert …", which a single contiguous-substring match would miss.
 * `bodyText` is included so content mentioned only inside the email body (past
 * the short snippet preview) is still findable. A trailing "s" is stemmed so
 * "alerts" matches "alert". Returns `[]` for an empty query.
 */
export function buildEmailSearchClauses(search?: string) {
	const term = search?.trim();
	if (!term) {
		return [];
	}
	// Split on whitespace; cap the number of terms so a pathological query
	// can't explode into a huge AND.
	const words = term.split(/\s+/).filter(Boolean).slice(0, 10);
	return words.map((word) => {
		// Match the word with a trailing "s" removed — "alert" is a substring of
		// both "alert" and "alerts", so this catches the singular/plural pair.
		const stem =
			word.length > 3 && word.toLowerCase().endsWith("s")
				? word.slice(0, -1)
				: word;
		const contains = { contains: stem, mode: "insensitive" as const };
		return {
			OR: [
				{ from: contains },
				{ fromEmail: contains },
				{ to: contains },
				{ subject: contains },
				{ snippet: contains },
				{ bodyText: contains },
			],
		};
	});
}

export async function upsertEmail(data: EmailUpsertData) {
	return db.email.upsert({
		where: { id: data.id },
		create: data,
		update: {
			labelIds: data.labelIds,
			isUnread: data.isUnread,
			snippet: data.snippet,
			// Keep body/subject from first sync — avoids re-writing large text blobs
		},
	});
}

export async function upsertEmailsBatch(emails: EmailUpsertData[]) {
	// Chunk into 50s to avoid hitting Postgres parameter limits
	const CHUNK = 50;
	for (let i = 0; i < emails.length; i += CHUNK) {
		const chunk = emails.slice(i, i + CHUNK);
		await Promise.all(chunk.map(upsertEmail));
	}
}

const EMAIL_LIST_SELECT = {
	id: true,
	threadId: true,
	from: true,
	fromEmail: true,
	to: true,
	subject: true,
	snippet: true,
	labelIds: true,
	isUnread: true,
	internalDate: true,
} as const;

export async function getEmailsByMailbox(
	mailboxId: string,
	opts: {
		folder?: string;
		label?: string;
		labelId?: string;
		/**
		 * Hide emails that carry any user/rule label (used by the Inbox view, so
		 * labelled mail lives only under its label and in "All Emails").
		 */
		excludeLabelled?: boolean;
		search?: string;
		/** Only emails on/after this instant (by internalDate). */
		since?: Date;
		/** Only emails strictly before this instant (by internalDate). */
		until?: Date;
		limit?: number;
		offset?: number;
	} = {},
) {
	const { folder = "inbox", label, labelId, excludeLabelled, search } = opts;
	// Guard against undefined/NaN reaching Prisma: `take`/`skip` must be concrete
	// integers (Prisma 7 errors on a missing `skip` when `take` is set).
	const limit = Number.isInteger(opts.limit) ? (opts.limit as number) : 50;
	const offset = Number.isInteger(opts.offset) ? (opts.offset as number) : 0;
	const labelFilter = FOLDER_LABEL[folder];

	// Label filter: match by name OR by Gmail label ID (covers old rows that only
	// stored the ID, and new rows that store both ID and name).
	const buildLabelFilter = () => {
		if (label) {
			if (labelId && labelId !== label) {
				return {
					OR: [
						{ labelIds: { has: label } },
						{ labelIds: { has: labelId } },
					],
				};
			}
			return { labelIds: { has: label } };
		}
		if (labelFilter) {
			return { labelIds: { has: labelFilter } };
		}
		// "All Emails" (folder === "all", no label): everything except the
		// Trash/Spam folders — mirrors Gmail's "All Mail".
		if (folder === "all") {
			return { NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } } };
		}
		return {};
	};

	// Date-range filter on internalDate (used for "today", "last week", etc.).
	const buildDateFilter = () => {
		if (!opts.since && !opts.until) {
			return {};
		}
		return {
			internalDate: {
				...(opts.since && { gte: opts.since }),
				...(opts.until && { lt: opts.until }),
			},
		};
	};

	// Combine search word-clauses under AND so they never collide with an OR
	// produced by the label filter (spreading two `OR` keys would drop one).
	const searchClauses = buildEmailSearchClauses(search);
	const where = {
		mailboxId,
		...buildLabelFilter(),
		...(searchClauses.length > 0 ? { AND: searchClauses } : {}),
		...buildDateFilter(),
	};

	// Fast path: no JS post-filter, let the DB do limit/offset.
	if (!excludeLabelled) {
		return db.email.findMany({
			where,
			orderBy: { internalDate: "desc" },
			take: limit,
			skip: offset,
			select: EMAIL_LIST_SELECT,
		});
	}

	// "Exclude labelled" (Inbox) can't be expressed as a Postgres array filter
	// over the open-ended set of user labels, so filter in JS. Page over the
	// *filtered* set by scanning rows in batches until we've skipped `offset`
	// matches and collected `limit` matches.
	const BATCH = Math.max(limit * 4, 100);
	type EmailListRow = Awaited<
		ReturnType<
			typeof db.email.findMany<{ select: typeof EMAIL_LIST_SELECT }>
		>
	>[number];
	const collected: EmailListRow[] = [];
	let skipped = 0;
	let scan = 0;
	for (;;) {
		const rows = await db.email.findMany({
			where,
			orderBy: { internalDate: "desc" },
			take: BATCH,
			skip: scan,
			select: EMAIL_LIST_SELECT,
		});
		if (rows.length === 0) {
			break;
		}
		scan += rows.length;
		for (const row of rows) {
			if (row.labelIds.some(isUserLabel)) {
				continue;
			}
			if (skipped < offset) {
				skipped++;
				continue;
			}
			collected.push(row);
			if (collected.length >= limit) {
				return collected;
			}
		}
		if (rows.length < BATCH) {
			break;
		}
	}
	return collected;
}

/**
 * Counts emails carrying a given label, matching either the label name or its
 * Gmail label ID (rows synced before we stored the name only carry the ID).
 * Trash/Spam are excluded so the count mirrors what the label view shows.
 */
export async function countEmailsByLabel(
	mailboxId: string,
	matchValues: string[],
): Promise<number> {
	if (matchValues.length === 0) {
		return 0;
	}
	return db.email.count({
		where: {
			mailboxId,
			labelIds: { hasSome: matchValues },
			NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } },
		},
	});
}

/**
 * Counts unread emails currently sitting in the Inbox, mirroring the sidebar's
 * "Inbox" badge. Trash/Spam are excluded so a message doesn't count twice
 * after being moved out of the inbox.
 */
export async function countUnreadInbox(mailboxId: string): Promise<number> {
	return db.email.count({
		where: {
			mailboxId,
			isUnread: true,
			labelIds: { has: "INBOX" },
			NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } },
		},
	});
}

/** Total current inbox size — denominator for the Dashboard's Inbox Zero %. */
export async function countInboxTotal(mailboxId: string): Promise<number> {
	return db.email.count({
		where: {
			mailboxId,
			labelIds: { has: "INBOX" },
			NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } },
		},
	});
}

/**
 * Unread + IMPORTANT inbox mail — the cross-provider "Priority" signal.
 * IMPORTANT is Gmail's own system label; Outlook mail gets it synthesized
 * from Graph's `importance: "high"` field (see outlook-parser.ts).
 */
export async function countPriorityInbox(mailboxId: string): Promise<number> {
	return db.email.count({
		where: {
			mailboxId,
			isUnread: true,
			labelIds: { hasEvery: ["INBOX", "IMPORTANT"] },
			NOT: { labelIds: { hasSome: ["TRASH", "SPAM"] } },
		},
	});
}

export async function getEmailById(mailboxId: string, id: string) {
	return db.email.findFirst({
		where: { id, mailboxId },
	});
}

/**
 * Finds recent inbox threads that the user has NOT replied to: the newest
 * inbox emails whose `threadId` never appears in the SENT folder. Used by the
 * assistant to answer "which emails haven't I replied to?".
 *
 * `search` optionally narrows the candidate inbox emails (sender/subject/snippet)
 * so it can be scoped to e.g. a client domain.
 */
export async function findUnansweredThreads(
	mailboxId: string,
	opts: { search?: string; limit?: number } = {},
) {
	const limit = Number.isInteger(opts.limit) ? (opts.limit as number) : 15;
	const searchClauses = buildEmailSearchClauses(opts.search);
	const searchFilter = searchClauses.length > 0 ? { AND: searchClauses } : {};

	// Thread ids the user has sent into (i.e. replied on / started).
	const sent = await db.email.findMany({
		where: { mailboxId, labelIds: { has: "SENT" } },
		select: { threadId: true },
	});
	const repliedThreadIds = new Set(sent.map((e) => e.threadId));

	// Scan recent inbox emails, keeping the newest one per thread that has no
	// matching SENT message.
	const inbox = await db.email.findMany({
		where: {
			mailboxId,
			labelIds: { has: "INBOX" },
			...searchFilter,
		},
		orderBy: { internalDate: "desc" },
		take: Math.max(limit * 8, 120),
		select: EMAIL_LIST_SELECT,
	});

	const seenThreads = new Set<string>();
	const result: typeof inbox = [];
	for (const email of inbox) {
		if (repliedThreadIds.has(email.threadId)) {
			continue;
		}
		if (seenThreads.has(email.threadId)) {
			continue;
		}
		seenThreads.add(email.threadId);
		result.push(email);
		if (result.length >= limit) {
			break;
		}
	}
	return result;
}

/** Removes the local copy of an email (e.g. on permanent delete). */
export async function deleteEmail(mailboxId: string, id: string) {
	return db.email.deleteMany({
		where: { id, mailboxId },
	});
}

export async function updateEmailLabels(id: string, labelIds: string[]) {
	return db.email.update({
		where: { id },
		data: {
			labelIds,
			isUnread: labelIds.includes("UNREAD"),
		},
	});
}

export async function markEmailRead(id: string) {
	const email = await db.email.findUnique({
		where: { id },
		select: { labelIds: true },
	});
	if (!email) {
		return;
	}
	return db.email.update({
		where: { id },
		data: {
			isUnread: false,
			labelIds: email.labelIds.filter((l) => l !== "UNREAD"),
		},
	});
}

export async function markEmailUnread(id: string) {
	const email = await db.email.findUnique({
		where: { id },
		select: { labelIds: true },
	});
	if (!email) {
		return;
	}
	const labelIds = email.labelIds.includes("UNREAD")
		? email.labelIds
		: [...email.labelIds, "UNREAD"];
	return db.email.update({
		where: { id },
		data: {
			isUnread: true,
			labelIds,
		},
	});
}

export async function getMailboxSyncState(mailboxId: string) {
	return db.mailbox.findUnique({
		where: { id: mailboxId },
		select: { emailSyncComplete: true, emailSyncCursor: true },
	});
}

export async function updateMailboxSyncState(
	mailboxId: string,
	data: { emailSyncComplete?: boolean; emailSyncCursor?: string | null },
) {
	return db.mailbox.update({
		where: { id: mailboxId },
		data,
	});
}

export async function updateEmailCategory(
	id: string,
	category: "PRIMARY" | "NEWSLETTER" | "PROMOTION" | "SOCIAL",
) {
	return db.email.update({
		where: { id },
		data: { category, categorizedAt: new Date() },
	});
}
