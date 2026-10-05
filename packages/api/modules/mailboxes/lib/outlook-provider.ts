import type {
	ListMessagesOptions,
	ListMessagesResult,
	MailProvider,
} from "./mail-provider-types";
import {
	createOutlookCategory,
	createOutlookDraft,
	forwardOutlookMessage,
	getOutlookMessage,
	listOutlookCategories,
	listOutlookInboxMessages,
	moveOutlookMessage,
	replyToOutlookMessage,
	updateOutlookMessage,
} from "./outlook-client";
import { parseOutlookMessage } from "./outlook-parser";

async function getOrCreateCategory(
	accountId: string,
	name: string,
): Promise<string> {
	const categories = await listOutlookCategories(accountId);
	const existing = categories.find(
		(c) => c.displayName.toLowerCase() === name.toLowerCase(),
	);
	if (existing) {
		return existing.displayName;
	}
	await createOutlookCategory(accountId, name);
	return name;
}

export const outlookProvider: MailProvider = {
	async getParsedMessage(accountId, messageId) {
		const msg = await getOutlookMessage(accountId, messageId);
		return parseOutlookMessage(msg);
	},

	async listInboxMessages(
		accountId: string,
		opts: ListMessagesOptions,
	): Promise<ListMessagesResult> {
		const result = await listOutlookInboxMessages(accountId, {
			maxResults: opts.maxResults,
			skipToken: opts.pageToken ?? undefined,
			windowStart: opts.windowStart,
			windowEnd: opts.windowEnd,
		});
		const nextLink = result["@odata.nextLink"];
		let nextPageToken: string | null = null;
		if (nextLink) {
			const match = nextLink.match(/\$skipToken=([^&]+)/);
			nextPageToken = match ? decodeURIComponent(match[1]) : null;
		}
		return {
			messages: result.value.map((m) => ({ id: m.id })),
			nextPageToken,
		};
	},

	async applyLabel(accountId, messageId, label) {
		const categoryName = await getOrCreateCategory(accountId, label);
		const msg = await getOutlookMessage(accountId, messageId);
		const current = msg.categories ?? [];
		if (!current.includes(categoryName)) {
			await updateOutlookMessage(accountId, messageId, {
				categories: [...current, categoryName],
			});
		}
	},

	async archive(accountId, messageId) {
		await moveOutlookMessage(accountId, messageId, "Archive");
	},

	async markRead(accountId, messageId) {
		await updateOutlookMessage(accountId, messageId, { isRead: true });
	},

	async markSpam(accountId, messageId) {
		await moveOutlookMessage(accountId, messageId, "JunkEmail");
	},

	async reply(accountId, email, content) {
		await replyToOutlookMessage(accountId, email.id, content);
	},

	async forward(accountId, email, to, content) {
		await forwardOutlookMessage(accountId, email.id, to, content ?? "");
	},

	async createDraft(accountId, email, to, subject, content, _mailboxEmail) {
		await createOutlookDraft(accountId, {
			to: to ?? email.fromEmail,
			subject: subject ?? `Re: ${email.subject}`,
			body: content ?? "",
		});
	},
};
