import { ORPCError } from "@orpc/server";
import { logger } from "@repo/logs";
import { type gmail_v1, google } from "googleapis";
import { getOAuth2Client } from "./google-auth";

type Gmail = gmail_v1.Gmail;

async function getGmail(accountId: string): Promise<Gmail> {
	const auth = await getOAuth2Client(accountId);
	return google.gmail({ version: "v1", auth });
}

function translateGmailError(error: unknown, accountId: string): Error {
	if (error instanceof ORPCError) {
		return error;
	}

	const message = error instanceof Error ? error.message : String(error);
	const status =
		(error as { response?: { status?: number } }).response?.status ??
		(error as { status?: number }).status;

	if (
		message.includes("invalid_grant") ||
		message.includes("invalid_token")
	) {
		logger.warn("[gmail-client] Refresh token rejected by Google", {
			accountId,
		});
		return new ORPCError("UNAUTHORIZED", {
			message:
				"Gmail connection expired — please reconnect your mailbox.",
		});
	}

	if (status === 401 || status === 403) {
		logger.warn("[gmail-client] Gmail authorization rejected", {
			accountId,
			status,
			message,
		});
		return new ORPCError("UNAUTHORIZED", {
			message:
				"Gmail authorization is no longer valid — please reconnect your mailbox.",
		});
	}

	logger.error("[gmail-client] Gmail API error", {
		accountId,
		status,
		message,
	});
	return error instanceof Error ? error : new Error(message);
}

async function callGmail<T>(
	accountId: string,
	fn: (gmail: Gmail) => Promise<T>,
): Promise<T> {
	const gmail = await getGmail(accountId);
	try {
		return await fn(gmail);
	} catch (error) {
		throw translateGmailError(error, accountId);
	}
}

// --- Message Operations ---

export async function listMessages(
	accountId: string,
	opts: {
		maxResults?: number;
		pageToken?: string;
		q?: string;
		labelIds?: string[];
	} = {},
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.messages.list({
			userId: "me",
			maxResults: opts.maxResults,
			pageToken: opts.pageToken,
			q: opts.q,
			labelIds: opts.labelIds,
		});
		return res.data;
	});
}

export async function getMessage(
	accountId: string,
	messageId: string,
	format: "minimal" | "full" | "metadata" = "full",
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.messages.get({
			userId: "me",
			id: messageId,
			format,
		});
		return res.data;
	});
}

export async function modifyMessageLabels(
	accountId: string,
	messageId: string,
	addLabelIds: string[] = [],
	removeLabelIds: string[] = [],
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.messages.modify({
			userId: "me",
			id: messageId,
			requestBody: { addLabelIds, removeLabelIds },
		});
		return res.data;
	});
}

// --- Label Operations ---

export async function listLabels(accountId: string) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.labels.list({ userId: "me" });
		return res.data.labels ?? [];
	});
}

export async function createLabel(accountId: string, name: string) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.labels.create({
			userId: "me",
			requestBody: {
				name,
				labelListVisibility: "labelShow",
				messageListVisibility: "show",
			},
		});
		return res.data;
	});
}

// --- Watch / History Operations ---

export async function startWatch(accountId: string, topicName: string) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.watch({
			userId: "me",
			requestBody: { topicName },
		});
		logger.info("[gmail-client] Watch registration response", {
			accountId,
			topicName,
			historyId: res.data.historyId,
			expiration: res.data.expiration,
		});
		return res.data;
	});
}

export async function stopWatch(accountId: string) {
	await callGmail(accountId, async (gmail) => {
		await gmail.users.stop({ userId: "me" });
	});
}

export async function listHistory(
	accountId: string,
	startHistoryId: string,
	opts: {
		maxResults?: number;
		historyTypes?: string[];
		labelId?: string;
	} = {},
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.history.list({
			userId: "me",
			startHistoryId,
			maxResults: opts.maxResults,
			historyTypes: opts.historyTypes,
			labelId: opts.labelId,
		});
		return res.data;
	});
}

export async function trashMessage(accountId: string, messageId: string) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.messages.trash({
			userId: "me",
			id: messageId,
		});
		return res.data;
	});
}

/**
 * Ensures a message is in Gmail's Trash. Used by our "delete" action: Gmail's
 * true permanent-delete API (messages.delete) needs the broad
 * `https://mail.google.com/` scope, which we don't request — so we keep the
 * message in Trash (Gmail auto-purges after 30 days) and remove our local copy
 * so it disappears from the app immediately. Trashing is idempotent.
 */
export async function deleteMessage(accountId: string, messageId: string) {
	return callGmail(accountId, async (gmail) => {
		await gmail.users.messages.trash({
			userId: "me",
			id: messageId,
		});
	});
}

// --- Send / Draft Operations ---

export async function sendMessage(accountId: string, raw: string) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.messages.send({
			userId: "me",
			requestBody: { raw },
		});
		return res.data;
	});
}

export async function createDraft(
	accountId: string,
	raw: string,
	threadId?: string,
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.drafts.create({
			userId: "me",
			requestBody: {
				message: { raw, ...(threadId ? { threadId } : {}) },
			},
		});
		return res.data;
	});
}

export async function updateDraft(
	accountId: string,
	draftId: string,
	raw: string,
	threadId?: string,
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.drafts.update({
			userId: "me",
			id: draftId,
			requestBody: {
				message: { raw, ...(threadId ? { threadId } : {}) },
			},
		});
		return res.data;
	});
}

export async function sendDraft(accountId: string, draftId: string) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.drafts.send({
			userId: "me",
			requestBody: { id: draftId },
		});
		return res.data;
	});
}

export async function deleteDraft(accountId: string, draftId: string) {
	return callGmail(accountId, async (gmail) => {
		await gmail.users.drafts.delete({ userId: "me", id: draftId });
	});
}

export async function listDrafts(
	accountId: string,
	opts: { maxResults?: number; pageToken?: string } = {},
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.drafts.list({
			userId: "me",
			maxResults: opts.maxResults,
			pageToken: opts.pageToken,
		});
		return res.data;
	});
}

export async function getDraft(
	accountId: string,
	draftId: string,
	format: "minimal" | "full" | "metadata" | "raw" = "full",
) {
	return callGmail(accountId, async (gmail) => {
		const res = await gmail.users.drafts.get({
			userId: "me",
			id: draftId,
			format,
		});
		return res.data;
	});
}
