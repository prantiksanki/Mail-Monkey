import { logger } from "@repo/logs";
import type { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";
import {
	createSmtpTransport,
	type ImapCredentials,
	withImapConnection,
} from "./imap-client";
import { decodeMessageId, encodeMessageId } from "./imap-message-id";
import { parseImapMessage } from "./imap-parser";
import type {
	ListMessagesOptions,
	ListMessagesResult,
	MailProvider,
} from "./mail-provider-types";

const INBOX = "INBOX";

/**
 * Resolves a well-known folder by IMAP SPECIAL-USE attribute (RFC 6154) —
 * the only portable way to find "Sent"/"Drafts"/"Junk"/"Archive" across
 * providers, since the display name varies (Zoho, Titan, iCloud, Fastmail
 * don't all agree). Falls back to `fallbackName`, creating it if missing, for
 * servers that don't advertise SPECIAL-USE at all.
 */
export async function resolveSpecialUseFolder(
	client: ImapFlow,
	specialUse: "\\Sent" | "\\Drafts" | "\\Junk" | "\\Archive" | "\\Trash",
	fallbackName: string,
): Promise<string> {
	const list = await client.list();
	const match = list.find((m) => m.specialUse === specialUse);
	if (match) {
		return match.path;
	}
	const existing = list.find(
		(m) => m.path.toLowerCase() === fallbackName.toLowerCase(),
	);
	if (existing) {
		return existing.path;
	}
	await client.mailboxCreate(fallbackName).catch(() => {
		// Race with another process creating it, or server rejects the exact
		// name — either way a subsequent open/append will surface the real error.
	});
	return fallbackName;
}

const FOLDER_SPECIAL_USE: Record<
	string,
	{ specialUse: string; names: string[] } | undefined
> = {
	sent: { specialUse: "\\Sent", names: ["sent", "sent items", "sent mail"] },
	drafts: { specialUse: "\\Drafts", names: ["drafts"] },
	trash: {
		specialUse: "\\Trash",
		names: ["trash", "deleted items", "deleted messages"],
	},
	spam: { specialUse: "\\Junk", names: ["junk", "spam", "junk email"] },
};

/**
 * Maps a logical app folder to the account's real IMAP path without creating
 * anything (reads must not mutate the account). Returns null when the server
 * has no such folder, so the caller can show an empty list.
 */
async function findFolderPath(
	client: ImapFlow,
	folder: string | undefined,
): Promise<string | null> {
	const spec = folder ? FOLDER_SPECIAL_USE[folder] : undefined;
	if (!spec) {
		return INBOX;
	}
	const list = await client.list();
	const match =
		list.find((m) => m.specialUse === spec.specialUse) ??
		list.find((m) => spec.names.includes(m.path.toLowerCase()));
	return match?.path ?? null;
}

/**
 * Folders that are part of the app's built-in navigation (or server
 * plumbing), so they must not also appear as user labels in the sidebar.
 */
const SYSTEM_FOLDER_NAMES = new Set([
	"inbox",
	"drafts",
	"templates",
	"snoozed",
	"sent",
	"sent items",
	"sent mail",
	"spam",
	"junk",
	"junk email",
	"trash",
	"deleted items",
	"deleted messages",
	"archive",
	"outbox",
	"all mail",
	"starred",
	"important",
]);

/**
 * The account's own folders (e.g. Zoho's "Newsletter"/"Notification"), which
 * IMAP treats as the equivalent of labels, with their unread counts. Excludes
 * the folders the app already surfaces as Inbox/Sent/Drafts/Trash/Spam/Archive.
 */
export async function listImapLabelFolders(
	accountId: string,
): Promise<Array<{ name: string; unread: number }>> {
	return withImapConnection(accountId, async (client) => {
		const list = await client.list();
		const folders = list.filter(
			(m) =>
				!m.specialUse &&
				!m.flags?.has("\\Noselect") &&
				!SYSTEM_FOLDER_NAMES.has(m.path.toLowerCase()),
		);
		const result: Array<{ name: string; unread: number }> = [];
		for (const folder of folders) {
			let unread = 0;
			try {
				const status = await client.status(folder.path, {
					unseen: true,
				});
				unread = status.unseen ?? 0;
			} catch {
				// Count is cosmetic — still show the folder.
			}
			result.push({ name: folder.path, unread });
		}
		return result;
	});
}

/** Resolves a label name to the real folder path (case-insensitive), or null. */
async function findLabelFolder(
	client: ImapFlow,
	label: string,
): Promise<string | null> {
	const list = await client.list();
	return (
		list.find((m) => m.path.toLowerCase() === label.toLowerCase())?.path ??
		null
	);
}

async function getOrCreateFolder(
	client: ImapFlow,
	name: string,
): Promise<string> {
	const list = await client.list();
	const existing = list.find(
		(m) => m.path.toLowerCase() === name.toLowerCase(),
	);
	if (existing) {
		return existing.path;
	}
	await client.mailboxCreate(name);
	return name;
}

/** Builds a raw RFC 5322 message without sending it, via nodemailer's stream transport. */
async function buildRawMessage(
	mailOptions: Parameters<
		ReturnType<typeof nodemailer.createTransport>["sendMail"]
	>[0],
): Promise<Buffer> {
	const streamTransport = nodemailer.createTransport({
		streamTransport: true,
		buffer: true,
		newline: "unix",
	});
	const info = await streamTransport.sendMail(mailOptions);
	return info.message as Buffer;
}

/**
 * Best-effort copy of a sent message into the account's Sent folder. Unlike
 * Gmail/Outlook (whose send APIs file a Sent copy automatically), plain SMTP
 * has no such behavior — without this, mail sent through Mail Monkey would
 * never show up in the user's own Sent folder. Failure here doesn't fail the
 * send itself: the message already reached its recipient.
 */
async function appendToSent(
	client: ImapFlow,
	raw: Buffer,
	accountId: string,
): Promise<void> {
	try {
		const sentFolder = await resolveSpecialUseFolder(
			client,
			"\\Sent",
			"Sent",
		);
		await client.append(sentFolder, raw, ["\\Seen"]);
	} catch (error) {
		logger.warn("[imap-provider] Failed to append sent copy", {
			accountId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * Downloads one attachment's raw content, re-fetching and re-parsing the
 * whole message — ParsedEmail.attachments only carries metadata (see
 * imap-parser.ts), not the content buffer, matching how Gmail/Outlook
 * attachments are also fetched live rather than cached
 * (payment-tracking/procedures/get-attachment.ts).
 */
export async function getImapAttachmentContent(
	accountId: string,
	messageId: string,
	attachmentId: string,
): Promise<{ content: Buffer; mimeType: string; filename: string } | null> {
	const { folder, uid } = decodeMessageId(messageId);
	return withImapConnection(accountId, async (client) => {
		await client.mailboxOpen(folder, { readOnly: true });
		const message = await client.fetchOne(
			uid,
			{ uid: true, source: true },
			{ uid: true },
		);
		if (!message || !message.source) {
			return null;
		}
		const parsed = await simpleParser(message.source);
		const attachment = parsed.attachments.find(
			(a) => (a.contentId ?? a.filename ?? a.checksum) === attachmentId,
		);
		if (!attachment) {
			return null;
		}
		return {
			content: attachment.content,
			mimeType: attachment.contentType,
			filename: attachment.filename ?? "attachment",
		};
	});
}

/**
 * Sends a new message over the account's SMTP server and files a copy in the
 * Sent folder. `html` is sent as the HTML part (nodemailer derives no text
 * alternative, so callers pass `text` too).
 */
export async function sendImapEmail(
	accountId: string,
	message: {
		from: string;
		to: string;
		cc?: string | null;
		bcc?: string | null;
		subject: string;
		text: string;
		html?: string;
	},
): Promise<{ messageId: string | null }> {
	return withImapConnection(
		accountId,
		async (client, creds: ImapCredentials) => {
			const transport = createSmtpTransport(creds);
			const mailOptions = {
				from: message.from,
				to: message.to,
				cc: message.cc || undefined,
				bcc: message.bcc || undefined,
				subject: message.subject,
				text: message.text,
				html: message.html,
			};
			const info = await transport.sendMail(mailOptions);
			const raw = await buildRawMessage(mailOptions);
			await appendToSent(client, raw, accountId);
			return {
				messageId: (info.messageId as string | undefined) ?? null,
			};
		},
	);
}

export interface SyncFolder {
	path: string;
	/** System label stamped on every message synced from this folder. */
	label: string | null;
}

/**
 * The folders mirrored into the local DB, with the Gmail-style system label
 * each one maps to (INBOX/SENT/TRASH/SPAM) — that label is what the inbox,
 * Sent, Trash and Spam views and the AI assistant filter on. Archive is
 * mirrored without a label so it shows up under "All Emails" only.
 */
export async function findSyncFolders(client: ImapFlow): Promise<SyncFolder[]> {
	const list = await client.list();
	const folders: SyncFolder[] = [{ path: INBOX, label: "INBOX" }];
	const add = (specialUse: string, names: string[], label: string | null) => {
		const match =
			list.find((m) => m.specialUse === specialUse) ??
			list.find((m) => names.includes(m.path.toLowerCase()));
		if (match && !folders.some((f) => f.path === match.path)) {
			folders.push({ path: match.path, label });
		}
	};
	for (const [label, key] of [
		["SENT", "sent"],
		["TRASH", "trash"],
		["SPAM", "spam"],
	] as const) {
		const spec = FOLDER_SPECIAL_USE[key];
		if (spec) {
			add(spec.specialUse, spec.names, label);
		}
	}
	add("\\Archive", ["archive", "archives"], null);
	return folders;
}

/**
 * "Delete" for IMAP: a message outside Trash is moved there (recoverable),
 * and one already in Trash is expunged for good — the same two-step behaviour
 * as every mail client, and what the Trash view's delete button implies.
 */
export async function deleteImapMessage(
	accountId: string,
	messageId: string,
): Promise<void> {
	const { folder, uid } = decodeMessageId(messageId);
	await withImapConnection(accountId, async (client) => {
		await client.mailboxOpen(folder);
		const trashFolder = await resolveSpecialUseFolder(
			client,
			"\\Trash",
			"Trash",
		);
		if (folder.toLowerCase() === trashFolder.toLowerCase()) {
			await client.messageDelete(uid, { uid: true });
		} else {
			await client.messageMove(uid, trashFolder, { uid: true });
		}
	});
}

export const imapProvider: MailProvider = {
	async getParsedMessage(accountId, messageId) {
		const { folder, uid } = decodeMessageId(messageId);
		return withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder, { readOnly: true });
			const message = await client.fetchOne(
				uid,
				{ uid: true, flags: true, source: true },
				{ uid: true },
			);
			if (!message || !message.source) {
				throw new Error(
					`IMAP message ${messageId} not found in ${folder}`,
				);
			}
			const parsed = await parseImapMessage({
				uid,
				flags: message.flags ?? new Set(),
				source: message.source,
			});
			return { ...parsed, id: messageId };
		});
	},

	async listInboxMessages(
		accountId: string,
		opts: ListMessagesOptions,
	): Promise<ListMessagesResult> {
		return withImapConnection(accountId, async (client) => {
			// A label view lists the folder of that name (IMAP's label equivalent).
			const folderPath = opts.label
				? await findLabelFolder(client, opts.label)
				: await findFolderPath(client, opts.folder);
			if (!folderPath) {
				return {
					messages: [],
					nextPageToken: null,
					resultSizeEstimate: 0,
				};
			}
			await client.mailboxOpen(folderPath, { readOnly: true });

			const criteria: Record<string, Date> = {};
			if (opts.windowStart) {
				criteria.since = opts.windowStart;
			}
			if (opts.windowEnd) {
				criteria.before = opts.windowEnd;
			}
			// Every word must match somewhere (AND across words), mirroring the
			// DB search; `text` covers headers and body server-side.
			const words =
				opts.search?.trim().split(/\s+/).filter(Boolean).slice(0, 10) ??
				[];
			const searchCriteria: Record<string, unknown> = { ...criteria };
			if (words.length > 0) {
				searchCriteria.and = words.map((word) => ({
					or: [
						{ from: word },
						{ to: word },
						{ subject: word },
						{ body: word },
					],
				}));
			}
			const uids = await client.search(
				Object.keys(searchCriteria).length > 0
					? searchCriteria
					: { all: true },
				{ uid: true },
			);
			const ascending = [...(uids || [])].sort((a, b) => a - b);
			const descending = [...ascending].reverse();

			let startIndex = 0;
			if (opts.pageToken) {
				const cursorUid = Number(opts.pageToken);
				const found = descending.findIndex((uid) => uid < cursorUid);
				startIndex = found === -1 ? descending.length : found;
			}
			const maxResults = opts.maxResults ?? 20;
			const page = descending.slice(startIndex, startIndex + maxResults);
			const hasMore = startIndex + maxResults < descending.length;

			return {
				messages: page.map((uid) => ({
					id: encodeMessageId(folderPath, uid),
				})),
				nextPageToken:
					hasMore && page.length > 0
						? String(page[page.length - 1])
						: null,
				resultSizeEstimate: descending.length,
			};
		});
	},

	async applyLabel(accountId, messageId, label) {
		const { folder, uid } = decodeMessageId(messageId);
		await withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder);
			// Labels have no IMAP equivalent — a folder-per-label, copied into
			// (not moved) so the message stays in its original folder, is the
			// closest structural match to Gmail's non-exclusive labels.
			const labelFolder = await getOrCreateFolder(client, label);
			await client.messageCopy(uid, labelFolder, { uid: true });
		});
	},

	async deleteLabel(accountId, label) {
		await withImapConnection(accountId, async (client) => {
			const list = await client.list();
			const existing = list.find(
				(m) => m.path.toLowerCase() === label.toLowerCase(),
			);
			// Already gone — nothing to delete.
			if (!existing) {
				return;
			}
			await client.mailboxDelete(existing.path);
		});
	},

	async archive(accountId, messageId) {
		const { folder, uid } = decodeMessageId(messageId);
		await withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder);
			const archiveFolder = await resolveSpecialUseFolder(
				client,
				"\\Archive",
				"Archive",
			);
			await client.messageMove(uid, archiveFolder, { uid: true });
		});
	},

	async markRead(accountId, messageId) {
		const { folder, uid } = decodeMessageId(messageId);
		await withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder);
			await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
		});
	},

	async markUnread(accountId, messageId) {
		const { folder, uid } = decodeMessageId(messageId);
		await withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder);
			await client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });
		});
	},

	async trash(accountId, messageId) {
		const { folder, uid } = decodeMessageId(messageId);
		await withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder);
			const trashFolder = await resolveSpecialUseFolder(
				client,
				"\\Trash",
				"Trash",
			);
			await client.messageMove(uid, trashFolder, { uid: true });
		});
	},

	async markSpam(accountId, messageId) {
		const { folder, uid } = decodeMessageId(messageId);
		await withImapConnection(accountId, async (client) => {
			await client.mailboxOpen(folder);
			const junkFolder = await resolveSpecialUseFolder(
				client,
				"\\Junk",
				"Junk",
			);
			await client.messageMove(uid, junkFolder, { uid: true });
		});
	},

	async reply(accountId, email, content, mailboxEmail) {
		await withImapConnection(
			accountId,
			async (client, creds: ImapCredentials) => {
				const transport = createSmtpTransport(creds);
				const mailOptions = {
					from: mailboxEmail,
					to: email.fromEmail,
					subject: email.subject.startsWith("Re:")
						? email.subject
						: `Re: ${email.subject}`,
					text: content,
					inReplyTo: email.headers["message-id"],
					references: email.headers["message-id"],
				};
				await transport.sendMail(mailOptions);
				const raw = await buildRawMessage(mailOptions);
				await appendToSent(client, raw, accountId);
			},
		);
	},

	async forward(accountId, email, to, content, cc, mailboxEmail) {
		await withImapConnection(
			accountId,
			async (client, creds: ImapCredentials) => {
				const transport = createSmtpTransport(creds);
				const body = `${content ?? ""}\n\n---------- Forwarded message ----------\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.bodyText}`;
				const mailOptions = {
					from: mailboxEmail,
					to,
					cc,
					subject: email.subject.startsWith("Fwd:")
						? email.subject
						: `Fwd: ${email.subject}`,
					text: body,
				};
				await transport.sendMail(mailOptions);
				const raw = await buildRawMessage(mailOptions);
				await appendToSent(client, raw, accountId);
			},
		);
	},

	async createDraft(accountId, email, to, subject, content, mailboxEmail) {
		await withImapConnection(accountId, async (client) => {
			const raw = await buildRawMessage({
				from: mailboxEmail,
				to: to || email.fromEmail,
				subject: subject || `Re: ${email.subject}`,
				text: content || "",
			});
			const draftsFolder = await resolveSpecialUseFolder(
				client,
				"\\Drafts",
				"Drafts",
			);
			await client.append(draftsFolder, raw, ["\\Draft"]);
		});
	},
};
