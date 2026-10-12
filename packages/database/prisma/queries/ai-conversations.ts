import { db } from "../client";
import type { Prisma } from "../generated/client";

/**
 * Lists a user's AI conversations for a mailbox, most-recently-updated first.
 * Returns lightweight rows (no messages) for the conversation list UI.
 */
export async function listConversations({
	userId,
	mailboxId,
}: {
	userId: string;
	mailboxId: string;
}) {
	return db.aiConversation.findMany({
		where: { userId, mailboxId },
		orderBy: { updatedAt: "desc" },
		select: {
			id: true,
			title: true,
			createdAt: true,
			updatedAt: true,
		},
	});
}

/**
 * Fetches a single conversation with its full message history (oldest first),
 * scoped to the owning user. Returns `null` if it doesn't exist or isn't owned
 * by `userId` — callers treat both as "not found" without leaking existence.
 */
export async function getConversation({
	id,
	userId,
}: {
	id: string;
	userId: string;
}) {
	return db.aiConversation.findFirst({
		where: { id, userId },
		include: {
			messages: { orderBy: { createdAt: "asc" } },
		},
	});
}

export async function createConversation({
	userId,
	mailboxId,
	title,
}: {
	userId: string;
	mailboxId: string;
	title?: string;
}) {
	return db.aiConversation.create({
		data: {
			userId,
			mailboxId,
			...(title ? { title } : {}),
		},
	});
}

/**
 * Appends messages to a conversation and bumps its `updatedAt` in one
 * transaction, so the list ordering stays in sync with new activity.
 */
export async function appendMessages({
	conversationId,
	messages,
}: {
	conversationId: string;
	messages: Array<{ role: string; parts: Prisma.InputJsonValue }>;
}) {
	return db.$transaction([
		db.aiChatMessage.createMany({
			data: messages.map((m) => ({
				conversationId,
				role: m.role,
				parts: m.parts,
			})),
		}),
		db.aiConversation.update({
			where: { id: conversationId },
			data: { updatedAt: new Date() },
		}),
	]);
}

export async function renameConversation({
	id,
	userId,
	title,
}: {
	id: string;
	userId: string;
	title: string;
}) {
	// updateMany with the userId guard so a user can only rename their own row.
	const result = await db.aiConversation.updateMany({
		where: { id, userId },
		data: { title: title.trim().slice(0, 120) || "New chat" },
	});
	return result.count > 0;
}

export async function deleteConversation({
	id,
	userId,
}: {
	id: string;
	userId: string;
}) {
	const result = await db.aiConversation.deleteMany({
		where: { id, userId },
	});
	return result.count > 0;
}
