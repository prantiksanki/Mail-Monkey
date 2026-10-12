import { CATEGORY_GMAIL_COLORS, categoryForLabelName } from "../rule-templates";
import { type GmailMessage, parseGmailMessage } from "./email-parser";
import {
	createDraft,
	createLabel,
	deleteLabel,
	getMessage,
	listLabels,
	listMessages,
	modifyMessageLabels,
	sendMessage,
	trashMessage,
	updateLabelColor,
} from "./gmail-client";
import { type LabelColor, labelColorForName } from "./label-colors";
import type {
	ListMessagesOptions,
	ListMessagesResult,
	MailProvider,
} from "./mail-provider-types";

/**
 * Colour for a label: when the label comes from a known rule template we use its
 * category colour (matching the Rules-page tag / sidebar dot); otherwise we fall
 * back to a deterministic name-hash colour. Both are Gmail-palette values so the
 * label renders identically in Gmail and ZeroMail.
 */
function labelColorForLabelName(labelName: string): LabelColor {
	const category = categoryForLabelName(labelName);
	return category
		? CATEGORY_GMAIL_COLORS[category]
		: labelColorForName(labelName);
}

function encodeRfc2822(
	from: string,
	to: string,
	subject: string,
	body: string,
	extra?: {
		cc?: string;
		inReplyTo?: string;
		references?: string;
	},
): string {
	const headers = [
		`From: ${from}`,
		`To: ${to}`,
		`Subject: ${subject}`,
		`Content-Type: text/plain; charset="UTF-8"`,
		"MIME-Version: 1.0",
	];
	if (extra?.cc) {
		headers.push(`Cc: ${extra.cc}`);
	}
	if (extra?.inReplyTo) {
		headers.push(`In-Reply-To: ${extra.inReplyTo}`);
	}
	if (extra?.references) {
		headers.push(`References: ${extra.references}`);
	}

	return Buffer.from(`${headers.join("\r\n")}\r\n\r\n${body}`)
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

async function getOrCreateLabel(
	accountId: string,
	labelName: string,
): Promise<string> {
	const color = labelColorForLabelName(labelName);
	const labels = (await listLabels(accountId)) as {
		id: string;
		name: string;
		color?: { backgroundColor?: string; textColor?: string };
	}[];
	const existing = labels.find(
		(l) => l.name.toLowerCase() === labelName.toLowerCase(),
	);
	if (existing) {
		// Correct the colour of a pre-existing label (e.g. one created before
		// colour sync, or edited in Gmail) so Gmail matches ZeroMail.
		if (existing.color?.backgroundColor !== color.backgroundColor) {
			await updateLabelColor(accountId, existing.id, color);
		}
		return existing.id;
	}
	const created = (await createLabel(accountId, labelName, color)) as {
		id: string;
	};
	return created.id;
}

export const gmailProvider: MailProvider = {
	async getParsedMessage(accountId, messageId) {
		const msg = (await getMessage(accountId, messageId)) as GmailMessage;
		return parseGmailMessage(msg);
	},

	async listInboxMessages(
		accountId: string,
		opts: ListMessagesOptions,
	): Promise<ListMessagesResult> {
		const qParts: string[] = [];
		if (opts.windowStart) {
			const d = opts.windowStart;
			qParts.push(
				`after:${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
			);
		}
		if (opts.windowEnd) {
			const d = opts.windowEnd;
			qParts.push(
				`before:${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`,
			);
		}
		// When a date window is specified (backfill), search all mail — not just INBOX.
		// Without a window it's a live inbox view, so restrict to INBOX.
		const isBackfill = !!(opts.windowStart || opts.windowEnd);
		const result = await listMessages(accountId, {
			maxResults: opts.maxResults,
			pageToken: opts.pageToken ?? undefined,
			...(isBackfill ? {} : { labelIds: ["INBOX"] }),
			q: qParts.length > 0 ? qParts.join(" ") : undefined,
		});
		return {
			messages: (result.messages ?? []).map((m) => ({ id: m.id ?? "" })),
			nextPageToken: result.nextPageToken,
			resultSizeEstimate: result.resultSizeEstimate ?? undefined,
		};
	},

	async applyLabel(accountId, messageId, label) {
		const labelId = await getOrCreateLabel(accountId, label);
		await modifyMessageLabels(accountId, messageId, [labelId], []);
	},

	async deleteLabel(accountId, label) {
		const labels = (await listLabels(accountId)) as {
			id: string;
			name: string;
		}[];
		const existing = labels.find(
			(l) => l.name.toLowerCase() === label.toLowerCase(),
		);
		// Already gone (never created, or removed in Gmail) — nothing to do.
		if (!existing) {
			return;
		}
		await deleteLabel(accountId, existing.id);
	},

	async archive(accountId, messageId) {
		await modifyMessageLabels(accountId, messageId, [], ["INBOX"]);
	},

	async markRead(accountId, messageId) {
		await modifyMessageLabels(accountId, messageId, [], ["UNREAD"]);
	},

	async markUnread(accountId, messageId) {
		await modifyMessageLabels(accountId, messageId, ["UNREAD"], []);
	},

	async trash(accountId, messageId) {
		await trashMessage(accountId, messageId);
	},

	async markSpam(accountId, messageId) {
		await modifyMessageLabels(accountId, messageId, ["SPAM"], ["INBOX"]);
	},

	async reply(accountId, email, content, mailboxEmail) {
		const raw = encodeRfc2822(
			mailboxEmail,
			email.fromEmail,
			`Re: ${email.subject}`,
			content,
			{
				inReplyTo: email.headers["message-id"],
				references: email.headers["message-id"],
			},
		);
		await sendMessage(accountId, raw);
	},

	async forward(accountId, email, to, content, cc, mailboxEmail) {
		const body = `${content ?? ""}\n\n---------- Forwarded ----------\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${email.bodyText}`;
		const raw = encodeRfc2822(
			mailboxEmail,
			to,
			`Fwd: ${email.subject}`,
			body,
			{ cc },
		);
		await sendMessage(accountId, raw);
	},

	async createDraft(accountId, email, to, subject, content, mailboxEmail) {
		const raw = encodeRfc2822(
			mailboxEmail,
			to || email.fromEmail,
			subject || `Re: ${email.subject}`,
			content || "",
		);
		await createDraft(accountId, raw, email.threadId);
	},
};
