import { type GmailMessage, parseGmailMessage } from "./email-parser";
import {
	createDraft,
	createLabel,
	getMessage,
	listLabels,
	listMessages,
	modifyMessageLabels,
	sendMessage,
} from "./gmail-client";
import type {
	ListMessagesOptions,
	ListMessagesResult,
	MailProvider,
} from "./mail-provider-types";

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
	const labels = (await listLabels(accountId)) as {
		id: string;
		name: string;
	}[];
	const existing = labels.find(
		(l) => l.name.toLowerCase() === labelName.toLowerCase(),
	);
	if (existing) {
		return existing.id;
	}
	const created = (await createLabel(accountId, labelName)) as { id: string };
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

	async archive(accountId, messageId) {
		await modifyMessageLabels(accountId, messageId, [], ["INBOX"]);
	},

	async markRead(accountId, messageId) {
		await modifyMessageLabels(accountId, messageId, [], ["UNREAD"]);
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
