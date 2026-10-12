import type { ParsedEmail } from "./email-parser";

export interface ListMessagesOptions {
	maxResults?: number;
	pageToken?: string;
	windowStart?: Date;
	windowEnd?: Date;
	/** Free-text query; honored by providers that can search server-side (IMAP). */
	search?: string;
	/** Logical folder (inbox, sent, drafts, trash, spam, all); defaults to inbox. */
	folder?: string;
	/** Label view; IMAP lists the folder with this name. */
	label?: string;
}

export interface ListMessagesResult {
	messages: Array<{ id: string }>;
	nextPageToken?: string | null;
	resultSizeEstimate?: number;
}

export interface MailProvider {
	getParsedMessage(
		accountId: string,
		messageId: string,
	): Promise<ParsedEmail>;
	listInboxMessages(
		accountId: string,
		opts: ListMessagesOptions,
	): Promise<ListMessagesResult>;
	applyLabel(
		accountId: string,
		messageId: string,
		label: string,
	): Promise<void>;
	/**
	 * Removes a label/category entirely from the provider (Gmail label or
	 * Outlook master category), which also strips it from every message.
	 * Idempotent: a label that no longer exists is treated as success.
	 */
	deleteLabel(accountId: string, label: string): Promise<void>;
	archive(accountId: string, messageId: string): Promise<void>;
	markRead(accountId: string, messageId: string): Promise<void>;
	markUnread(accountId: string, messageId: string): Promise<void>;
	trash(accountId: string, messageId: string): Promise<void>;
	markSpam(accountId: string, messageId: string): Promise<void>;
	reply(
		accountId: string,
		email: ParsedEmail,
		content: string,
		mailboxEmail: string,
	): Promise<void>;
	forward(
		accountId: string,
		email: ParsedEmail,
		to: string,
		content: string | undefined,
		cc: string | undefined,
		mailboxEmail: string,
	): Promise<void>;
	createDraft(
		accountId: string,
		email: ParsedEmail,
		to: string | undefined,
		subject: string | undefined,
		content: string | undefined,
		mailboxEmail: string,
	): Promise<void>;
}
