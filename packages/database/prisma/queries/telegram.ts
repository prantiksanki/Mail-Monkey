import { randomBytes } from "node:crypto";
import { db } from "../client";

export type TelegramActionName = "ARCHIVE" | "MARK_READ" | "TRASH";

export async function createTelegramLinkToken(userId: string) {
	const token = randomBytes(24).toString("base64url");
	const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

	return db.telegramLinkToken.create({
		data: {
			token,
			userId,
			expiresAt,
		},
	});
}

export async function consumeTelegramLinkToken(token: string) {
	const linkToken = await db.telegramLinkToken.findUnique({
		where: { token },
		include: { user: true },
	});

	if (!linkToken || linkToken.usedAt || linkToken.expiresAt < new Date()) {
		return null;
	}

	await db.telegramLinkToken.update({
		where: { id: linkToken.id },
		data: { usedAt: new Date() },
	});

	return linkToken;
}

export async function upsertTelegramConnection(input: {
	userId: string;
	telegramUserId: string;
	chatId: string;
	username?: string | null;
	firstName?: string | null;
	lastName?: string | null;
	languageCode?: string | null;
}) {
	return db.telegramConnection.upsert({
		where: { telegramUserId: input.telegramUserId },
		update: {
			userId: input.userId,
			chatId: input.chatId,
			username: input.username,
			firstName: input.firstName,
			lastName: input.lastName,
			languageCode: input.languageCode,
			enabled: true,
		},
		create: {
			userId: input.userId,
			telegramUserId: input.telegramUserId,
			chatId: input.chatId,
			username: input.username,
			firstName: input.firstName,
			lastName: input.lastName,
			languageCode: input.languageCode,
		},
	});
}

export async function getTelegramConnectionByChatId(chatId: string) {
	return db.telegramConnection.findUnique({
		where: { chatId },
		include: {
			user: {
				include: {
					mailbox: {
						orderBy: { createdAt: "asc" },
					},
				},
			},
		},
	});
}

export async function getTelegramConnectionByUserId(userId: string) {
	return db.telegramConnection.findFirst({
		where: { userId },
		orderBy: { createdAt: "desc" },
	});
}

export async function listEnabledTelegramConnections() {
	return db.telegramConnection.findMany({
		where: { enabled: true },
		include: {
			user: {
				include: {
					mailbox: {
						orderBy: { createdAt: "asc" },
					},
				},
			},
		},
	});
}

export async function updateTelegramConnection(
	id: string,
	data: {
		enabled?: boolean;
		timezone?: string;
		dailyDigestTime?: string;
		lastBriefingSentAt?: Date | null;
	},
) {
	return db.telegramConnection.update({
		where: { id },
		data,
	});
}

export async function createTelegramAction(input: {
	userId: string;
	mailboxId: string;
	messageId: string;
	action: TelegramActionName;
}) {
	return db.telegramAction.create({
		data: {
			userId: input.userId,
			mailboxId: input.mailboxId,
			messageId: input.messageId,
			action: input.action,
			expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		},
	});
}

export async function getTelegramActionById(id: string) {
	return db.telegramAction.findUnique({
		where: { id },
		include: {
			mailbox: true,
		},
	});
}

export async function claimTelegramAction(id: string) {
	const action = await getTelegramActionById(id);
	if (!action || action.usedAt || action.expiresAt < new Date()) {
		return null;
	}

	const result = await db.telegramAction.updateMany({
		where: {
			id,
			usedAt: null,
			expiresAt: { gt: new Date() },
		},
		data: { usedAt: new Date() },
	});

	if (result.count !== 1) {
		return null;
	}

	return action;
}

export async function markTelegramActionUsed(id: string) {
	return db.telegramAction.update({
		where: { id },
		data: { usedAt: new Date() },
	});
}

export async function recordTelegramBriefing(input: {
	userId: string;
	mailboxId: string;
	briefingDate: Date;
	categoryCounts: Record<string, number>;
	messageIds: string[];
}) {
	return db.telegramBriefing.create({
		data: input,
	});
}
