import { db } from "../client";

export interface CreateNotificationInput {
	userId: string;
	type: string;
	title: string;
	body: string;
	emailId?: string;
}

export async function createNotification(input: CreateNotificationInput) {
	return db.notification.create({
		data: {
			userId: input.userId,
			type: input.type,
			title: input.title,
			body: input.body,
			emailId: input.emailId,
		},
	});
}

/** Unread notifications for a user, newest first. */
export async function getUnreadNotificationsByUserId(userId: string) {
	return db.notification.findMany({
		where: { userId, readAt: null },
		orderBy: { createdAt: "desc" },
	});
}

/**
 * Mark a notification as read. Scoped to the owning user so a user can only
 * dismiss their own notifications.
 */
export async function markNotificationRead(id: string, userId: string) {
	const result = await db.notification.updateMany({
		where: { id, userId, readAt: null },
		data: { readAt: new Date() },
	});

	return result.count > 0;
}
