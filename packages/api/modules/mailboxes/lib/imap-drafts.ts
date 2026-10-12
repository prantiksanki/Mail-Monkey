import { simpleParser } from "mailparser";
import MailComposer from "nodemailer/lib/mail-composer";
import { htmlToPlainText } from "./email-sender";
import { withImapConnection } from "./imap-client";
import { decodeMessageId, encodeMessageId } from "./imap-message-id";
import { resolveSpecialUseFolder, sendImapEmail } from "./imap-provider";
import { looksLikeHtml, sanitizeOutboundHtml } from "./sanitize-html";

/**
 * IMAP has no draft API: a draft is just a message in the Drafts folder
 * carrying the \Draft flag. Its id is "<folder>:<uid>" like any other IMAP
 * message. IMAP can't edit a message in place, so "update" appends the new
 * version and deletes the old one — which means the draft id changes on every
 * save (the compose dialog adopts the id returned by saveImapDraft).
 */

export interface ImapDraftInput {
	from: string;
	to?: string;
	cc?: string;
	bcc?: string;
	subject?: string;
	body?: string;
}

export async function saveImapDraft(
	accountId: string,
	input: ImapDraftInput,
	previousDraftId?: string,
): Promise<{ draftId: string | null }> {
	const body = input.body ?? "";
	const isHtml = looksLikeHtml(body);
	const html = isHtml ? sanitizeOutboundHtml(body) : undefined;
	// MailComposer (unlike a transport) allows a draft with no recipients yet.
	const raw = await new MailComposer({
		from: input.from,
		to: input.to || undefined,
		cc: input.cc || undefined,
		bcc: input.bcc || undefined,
		subject: input.subject ?? "",
		text: html ? htmlToPlainText(html) || " " : body,
		html,
		// Not in the published typings, but honored by MailComposer.
		...({ keepBcc: true } as object),
	})
		.compile()
		.build();

	return withImapConnection(accountId, async (client) => {
		const draftsFolder = await resolveSpecialUseFolder(
			client,
			"\\Drafts",
			"Drafts",
		);
		const appended = await client.append(draftsFolder, raw, ["\\Draft"]);
		const uid = appended ? appended.uid : undefined;

		if (previousDraftId) {
			const prev = decodeMessageId(previousDraftId);
			await client.mailboxOpen(prev.folder);
			await client.messageDelete(prev.uid, { uid: true });
		}

		return {
			draftId: uid ? encodeMessageId(draftsFolder, uid) : null,
		};
	});
}

async function fetchSource(accountId: string, draftId: string) {
	const { folder, uid } = decodeMessageId(draftId);
	return withImapConnection(accountId, async (client) => {
		await client.mailboxOpen(folder, { readOnly: true });
		const message = await client.fetchOne(
			uid,
			{ uid: true, internalDate: true, source: true },
			{ uid: true },
		);
		if (!message || !message.source) {
			return null;
		}
		return message;
	});
}

function addressText(
	field: Awaited<ReturnType<typeof simpleParser>>["to"],
): string {
	if (!field) {
		return "";
	}
	return (Array.isArray(field) ? field : [field])
		.map((f) => f.text)
		.join(", ");
}

export async function getImapDraft(accountId: string, draftId: string) {
	const message = await fetchSource(accountId, draftId);
	if (!message?.source) {
		return null;
	}
	const parsed = await simpleParser(message.source);
	const html = typeof parsed.html === "string" ? parsed.html : "";
	return {
		to: addressText(parsed.to),
		cc: addressText(parsed.cc),
		bcc: addressText(parsed.bcc),
		subject: parsed.subject ?? "",
		text: parsed.text ?? "",
		html,
	};
}

export async function listImapDrafts(accountId: string) {
	return withImapConnection(accountId, async (client) => {
		const list = await client.list();
		const folder =
			list.find((m) => m.specialUse === "\\Drafts") ??
			list.find((m) => m.path.toLowerCase() === "drafts");
		if (!folder) {
			return [];
		}
		await client.mailboxOpen(folder.path, { readOnly: true });
		const all = await client.search({ all: true }, { uid: true });
		const uids = [...(all || [])].sort((a, b) => b - a).slice(0, 50);
		if (uids.length === 0) {
			return [];
		}
		const rows: Array<{
			draftId: string;
			to: string;
			subject: string;
			snippet: string;
			date: string;
		}> = [];
		for await (const message of client.fetch(
			uids,
			{ uid: true, internalDate: true, source: true },
			{ uid: true },
		)) {
			if (!message.source) {
				continue;
			}
			const parsed = await simpleParser(message.source);
			rows.push({
				draftId: encodeMessageId(folder.path, message.uid),
				to: addressText(parsed.to),
				subject: parsed.subject ?? "",
				snippet: (parsed.text ?? "")
					.replace(/\s+/g, " ")
					.trim()
					.slice(0, 200),
				date: (parsed.date ?? new Date()).toISOString(),
			});
		}
		return rows.sort((a, b) => b.date.localeCompare(a.date));
	});
}

export async function deleteImapDraft(accountId: string, draftId: string) {
	const { folder, uid } = decodeMessageId(draftId);
	await withImapConnection(accountId, async (client) => {
		await client.mailboxOpen(folder);
		await client.messageDelete(uid, { uid: true });
	});
}

/** Sends a saved draft over SMTP, then removes it from the Drafts folder. */
export async function sendImapDraft(
	accountId: string,
	draftId: string,
	from: string,
): Promise<{ messageId: string | null } | null> {
	const draft = await getImapDraft(accountId, draftId);
	if (!draft) {
		return null;
	}
	const result = await sendImapEmail(accountId, {
		from,
		to: draft.to,
		cc: draft.cc || null,
		bcc: draft.bcc || null,
		subject: draft.subject,
		text: draft.text || " ",
		html: draft.html || undefined,
	});
	await deleteImapDraft(accountId, draftId);
	return result;
}
