import { db } from "../client";

export async function getMailboxByEmail(email: string) {
	return db.mailbox.findFirst({
		where: { email: email.toLowerCase() },
		include: { account: true },
	});
}

export async function getMailboxBySubscriptionId(subscriptionId: string) {
	return db.mailbox.findFirst({
		where: { subscriptionId },
		include: { account: true },
	});
}

export async function updateMailboxWatchState({
	id,
	watchEnabled,
	watchExpiry,
	lastHistoryId,
	subscriptionId,
	subscriptionClientState,
}: {
	id: string;
	watchEnabled: boolean;
	watchExpiry?: Date | null;
	lastHistoryId?: string | null;
	subscriptionId?: string | null;
	subscriptionClientState?: string | null;
}) {
	return db.mailbox.update({
		where: { id },
		data: {
			watchEnabled,
			...(watchExpiry !== undefined ? { watchExpiry } : {}),
			...(lastHistoryId !== undefined ? { lastHistoryId } : {}),
			...(subscriptionId !== undefined ? { subscriptionId } : {}),
			...(subscriptionClientState !== undefined
				? { subscriptionClientState }
				: {}),
		},
	});
}

export async function updateMailboxHistoryId(
	id: string,
	lastHistoryId: string,
) {
	return db.mailbox.update({
		where: { id },
		data: { lastHistoryId },
	});
}

export async function getMailboxesWithExpiringWatch(before: Date) {
	return db.mailbox.findMany({
		where: { watchEnabled: true, watchExpiry: { lt: before } },
		include: { account: true },
	});
}
