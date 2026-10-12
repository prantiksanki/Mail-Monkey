import { db, getEmailsByMailbox } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getMessage, listMessages } from "../lib/gmail-client";
import { imapProvider } from "../lib/imap-provider";
import {
	getLabelIdToNameMap,
	mapLabelIdsToNames,
	resolveLabelNameToId,
} from "../lib/label-resolver";
import { isUserLabel } from "../lib/label-utils";
import {
	getOutlookMessage,
	listOutlookInboxMessages,
} from "../lib/outlook-client";
import { verifyMailboxOwnership } from "../lib/ownership";
import type { RuleCondition } from "../types";

// Folders served from local DB when emails exist there
const DB_FOLDERS = new Set(["inbox", "sent", "drafts", "trash", "spam", "all"]);

const FOLDER_QUERY: Record<string, { q?: string; labelIds?: string[] }> = {
	inbox: { labelIds: ["INBOX"] },
	sent: { labelIds: ["SENT"] },
	drafts: { labelIds: ["DRAFT"] },
	trash: { labelIds: ["TRASH"] },
	spam: { labelIds: ["SPAM"] },
	// "All Emails" = everything except Trash/Spam (Gmail "All Mail" behavior).
	all: { q: "-in:trash -in:spam" },
};

export const listInboxMessages = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/inbox",
		tags: ["Mailboxes"],
		summary: "List inbox messages",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			folder: z.string().default("inbox"),
			label: z.string().optional(),
			search: z.string().optional(),
			pageToken: z.string().optional(),
			maxResults: z.number().min(1).max(50).default(20),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		// --- Try DB first for standard folders ---
		// On IMAP a label is a real server folder, which the local copy doesn't
		// mirror, so label views always read the folder live (below).
		const imapLabelView = mailbox.provider === "IMAP" && !!input.label;
		if (DB_FOLDERS.has(input.folder) && !imapLabelView) {
			// pageToken encodes the DB offset as base64
			const offset = input.pageToken
				? Number(Buffer.from(input.pageToken, "base64").toString())
				: 0;

			// When filtering by label name, also resolve to Gmail label ID so we
			// match rows that were synced before we started storing the name.
			// Outlook stores category names directly — no ID resolution needed.
			let resolvedLabelId: string | undefined;
			if (input.label && mailbox.provider === "GOOGLE") {
				// Resolve the label name → Gmail ID so the DB filter also matches
				// rows that stored only the raw ID (e.g. "Label_10"). Force-refreshes
				// on a miss so a just-created label view never silently under-matches.
				resolvedLabelId = await resolveLabelNameToId(
					mailbox.accountId,
					input.label,
				);
			}

			const emails = await getEmailsByMailbox(mailbox.id, {
				folder: input.folder,
				label: input.label,
				labelId: resolvedLabelId,
				// Inbox shows only unlabelled mail; labelled mail lives under its
				// label view and in "All Emails".
				excludeLabelled: input.folder === "inbox" && !input.label,
				search: input.search,
				limit: input.maxResults,
				offset,
			});

			// DB has emails — serve from there. When searching, the DB is the
			// authoritative source (the live provider fallbacks below can't honor
			// our free-text filter), so always return its result — even when empty.
			// IMAP is the exception: its live fallback can search server-side, so
			// an empty first page (sync not finished) falls through to it.
			const searchedDbIsFinal =
				!!input.search?.trim() &&
				!(mailbox.provider === "IMAP" && emails.length === 0);
			if (emails.length > 0 || offset > 0 || searchedDbIsFinal) {
				const nextOffset = offset + emails.length;
				const hasMore = emails.length === input.maxResults;

				// Resolve Gmail label IDs to display names. Outlook stores
				// category names directly in the DB so no mapping is needed.
				const labelIdToName =
					mailbox.provider === "GOOGLE"
						? await getLabelIdToNameMap(mailbox.accountId)
						: {};

				const isSentFolder = input.folder === "sent";

				return {
					messages: emails.map((e) => {
						// Sent mail: the row should identify the recipient, not the
						// account owner who sent it (mirrors the live Gmail fallback
						// below, which does the same from/to swap for SENT messages).
						const nameMatch = isSentFolder
							? e.to.match(/^([^<]+)</)
							: null;
						const emailMatch = isSentFolder
							? e.to.match(/<([^>]+)>/)
							: null;
						const displayFrom =
							isSentFolder && e.to
								? nameMatch
									? nameMatch[1].trim()
									: e.to
								: e.from;
						const displayFromEmail =
							isSentFolder && e.to
								? emailMatch
									? emailMatch[1]
									: e.to
								: e.fromEmail;

						return {
							id: e.id,
							threadId: e.threadId,
							from: displayFrom,
							fromEmail: displayFromEmail,
							subject: e.subject || "(No subject)",
							snippet: e.snippet,
							date: e.internalDate.toISOString(),
							labelIds: mapLabelIdsToNames(
								(e.labelIds as string[]).filter(isUserLabel),
								labelIdToName,
							),
							// Raw labels are filtered above, so surface trash state
							// explicitly for the "delete permanently" action.
							inTrash: (e.labelIds as string[]).includes("TRASH"),
							isUnread: e.isUnread,
						};
					}),
					nextPageToken: hasMore
						? Buffer.from(String(nextOffset)).toString("base64")
						: undefined,
				};
			}
			// DB is empty (sync not done yet) — fall through to live provider below
		}

		// --- Live IMAP fallback (window before the first sync completes) ---
		if (mailbox.provider === "IMAP") {
			const result = await imapProvider.listInboxMessages(
				mailbox.accountId,
				{
					maxResults: input.maxResults,
					pageToken: input.pageToken,
					search: input.search,
					folder: input.folder,
					label: input.label,
				},
			);
			const isSentView = input.folder === "sent";
			const messages = await Promise.all(
				result.messages.map(async (m) => {
					const parsed = await imapProvider.getParsedMessage(
						mailbox.accountId,
						m.id,
					);
					// Sent mail identifies the recipient, like the DB-served path.
					const recipientName = parsed.to.match(/^([^<]+)</);
					const recipientEmail = parsed.to.match(/<([^>]+)>/);
					return {
						id: parsed.id,
						threadId: parsed.threadId,
						from:
							isSentView && parsed.to
								? (recipientName?.[1].trim() ?? parsed.to)
								: parsed.from,
						fromEmail:
							isSentView && parsed.to
								? (recipientEmail?.[1] ?? parsed.to)
								: parsed.fromEmail,
						subject: parsed.subject || "(No subject)",
						snippet: parsed.snippet,
						date: parsed.date.toISOString(),
						labelIds: [],
						inTrash: false,
						isUnread: !parsed.labelIds.includes("SEEN"),
					};
				}),
			);
			return {
				messages,
				nextPageToken: result.nextPageToken ?? undefined,
			};
		}

		// --- Live Outlook fallback ---
		if (mailbox.provider === "OUTLOOK") {
			const outlookList = await listOutlookInboxMessages(
				mailbox.accountId,
				{
					maxResults: input.maxResults,
					skipToken: input.pageToken ?? undefined,
				},
			);

			const messages = await Promise.all(
				outlookList.value.map(async (m) => {
					const msg = await getOutlookMessage(
						mailbox.accountId,
						m.id,
					);
					const fromName =
						msg.from?.emailAddress?.name ??
						msg.from?.emailAddress?.address ??
						"";
					const fromEmail =
						msg.from?.emailAddress?.address ?? fromName;
					return {
						id: msg.id,
						threadId: msg.conversationId ?? "",
						from: fromName,
						fromEmail,
						subject: msg.subject ?? "(No subject)",
						snippet: msg.bodyPreview ?? "",
						date: msg.receivedDateTime,
						labelIds: msg.categories ?? [],
						inTrash: false,
						isUnread: !msg.isRead,
					};
				}),
			);

			const nextLink = outlookList["@odata.nextLink"];
			let nextPageToken: string | undefined;
			if (nextLink) {
				const match = nextLink.match(/\$skipToken=([^&]+)/);
				nextPageToken = match
					? decodeURIComponent(match[1])
					: undefined;
			}

			return { messages, nextPageToken };
		}

		// --- Live Gmail fallback ---
		const folderOpts =
			input.folder in FOLDER_QUERY
				? FOLDER_QUERY[input.folder]
				: FOLDER_QUERY.inbox;

		// Build the Gmail query for label views. First try the Gmail label name.
		// If the label hasn't been applied yet (rule just created, no emails
		// processed yet), also build a query from the rule's static condition so
		// the view shows matching emails even before the rule fires.
		let gmailQ = input.label
			? `in:all label:${input.label.replace(/\s+/g, "-")}${folderOpts.q ? ` ${folderOpts.q}` : ""}`
			: folderOpts.q;

		let list = await listMessages(mailbox.accountId, {
			maxResults: input.maxResults,
			pageToken: input.pageToken,
			...folderOpts,
			...(gmailQ !== folderOpts.q ? { q: gmailQ } : {}),
		});

		// If the label search returned nothing, try querying by the rule's static
		// condition (from/to/subject) so pre-existing emails surface immediately.
		if (!list.messages?.length && input.label && !input.pageToken) {
			try {
				const rules = await db.rule.findMany({
					where: { mailboxId: mailbox.id, enabled: true },
					select: { condition: true, actions: true },
				});
				type ActionRow = { type: string; fields?: { label?: string } };
				const rule = rules.find((r) =>
					(r.actions as ActionRow[]).some(
						(a) =>
							a.type === "LABEL" &&
							a.fields?.label?.toLowerCase() ===
								input.label?.toLowerCase(),
					),
				);
				if (rule) {
					const condition = rule.condition as RuleCondition;
					const parts: string[] = [];
					if (condition.static?.from) {
						parts.push(`from:${condition.static.from}`);
					}
					if (condition.static?.to) {
						parts.push(`to:${condition.static.to}`);
					}
					if (condition.static?.subject) {
						parts.push(`subject:${condition.static.subject}`);
					}
					if (parts.length > 0) {
						const op =
							condition.conditionalOperator === "OR"
								? " OR "
								: " ";
						gmailQ = `in:all ${parts.join(op)}`;
						list = await listMessages(mailbox.accountId, {
							maxResults: input.maxResults,
							q: gmailQ,
						});
					}
				}
			} catch {
				// Non-fatal — fall through with empty results
			}
		}

		if (!list.messages?.length) {
			return { messages: [], nextPageToken: undefined };
		}

		const liveLabelIdToName = await getLabelIdToNameMap(mailbox.accountId);

		const messages = await Promise.all(
			list.messages.map(async (m) => {
				if (!m.id) {
					return null;
				}
				const msg = await getMessage(
					mailbox.accountId,
					m.id,
					"metadata",
				);
				const headers = msg.payload?.headers ?? [];
				const get = (name: string) =>
					headers.find(
						(h) => h.name?.toLowerCase() === name.toLowerCase(),
					)?.value ?? "";

				const isSent = (msg.labelIds ?? []).includes("SENT");
				const fromRaw = get("from");
				const displayRaw = isSent ? get("to") || fromRaw : fromRaw;
				const nameMatch = displayRaw.match(/^([^<]+)</);
				const emailMatch = fromRaw.match(/<([^>]+)>/);
				const rawLabelIds = msg.labelIds ?? [];

				return {
					id: msg.id ?? m.id,
					threadId: msg.threadId ?? "",
					from: nameMatch ? nameMatch[1].trim() : displayRaw,
					fromEmail: emailMatch ? emailMatch[1] : fromRaw,
					subject: get("subject") || "(No subject)",
					snippet: msg.snippet ?? "",
					date: msg.internalDate
						? new Date(Number(msg.internalDate)).toISOString()
						: new Date().toISOString(),
					labelIds: mapLabelIdsToNames(
						rawLabelIds.filter(isUserLabel),
						liveLabelIdToName,
					),
					inTrash: rawLabelIds.includes("TRASH"),
					isUnread: rawLabelIds.includes("UNREAD"),
				};
			}),
		);

		return {
			messages: messages.filter(
				(m): m is NonNullable<typeof m> => m !== null,
			),
			nextPageToken: list.nextPageToken ?? undefined,
		};
	});
