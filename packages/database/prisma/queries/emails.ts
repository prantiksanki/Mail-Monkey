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

	// Free-text search across the sender, subject and snippet. Case-insensitive
	// substring match so "matches anywhere" feels like Gmail's quick search.
	const buildSearchFilter = () => {
		const term = search?.trim();
		if (!term) {
			return {};
		}
		const contains = { contains: term, mode: "insensitive" as const };
		return {
			OR: [
				{ from: contains },
				{ fromEmail: contains },
				{ subject: contains },
				{ snippet: contains },
			],
		};
	};

	const where = { mailboxId, ...buildLabelFilter(), ...buildSearchFilter() };

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

export async function getEmailById(mailboxId: string, id: string) {
	return db.email.findFirst({
		where: { id, mailboxId },
	});
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
