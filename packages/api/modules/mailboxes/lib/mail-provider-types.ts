import type { ParsedEmail } from "./email-parser";

export interface ListMessagesOptions {
	maxResults?: number;
	pageToken?: string;
	windowStart?: Date;
	windowEnd?: Date;
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
	archive(accountId: string, messageId: string): Promise<void>;
	markRead(accountId: string, messageId: string): Promise<void>;
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
