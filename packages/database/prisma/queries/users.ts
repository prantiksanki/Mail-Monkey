import type { z } from "zod";
import { db } from "../client";
import type { UserSchema } from "../zod";

export async function getUsers({
	limit,
	offset,
	query,
}: {
	limit: number;
	offset: number;
	query?: string;
}) {
	return await db.user.findMany({
		where: query
			? {
					OR: [
						{
							name: {
								contains: query,
								mode: "insensitive",
							},
						},
						{
							email: {
								contains: query,
								mode: "insensitive",
							},
						},
					],
				}
			: undefined,
		take: limit,
		skip: offset,
	});
}

export async function countAllUsers({ query }: { query?: string }) {
	return await db.user.count({
		where: query
			? {
					OR: [
						{
							name: {
								contains: query,
								mode: "insensitive",
							},
						},
						{
							email: {
								contains: query,
								mode: "insensitive",
							},
						},
					],
				}
			: undefined,
	});
}

export async function getUserById(id: string) {
	return await db.user.findUnique({
		where: {
			id,
		},
	});
}

export async function getUserByEmail(email: string) {
	return await db.user.findUnique({
		where: {
			email,
		},
	});
}

export async function getUserByUsername(username: string) {
	return await db.user.findUnique({
		where: {
			username,
		},
	});
}

export async function createUser({
	email,
	name,
	role,
	emailVerified,
	onboardingComplete,
	mustChangePassword,
}: {
	email: string;
	name: string;
	role: "admin" | "user";
	emailVerified: boolean;
	onboardingComplete: boolean;
	mustChangePassword?: boolean;
}) {
	return await db.user.create({
		data: {
			email,
			name,
			role,
			emailVerified,
			onboardingComplete,
			mustChangePassword,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
}

export async function getAccountById(id: string) {
	return await db.account.findUnique({
		where: {
			id,
		},
	});
}

export async function createUserAccount({
	userId,
	providerId,
	accountId,
	hashedPassword,
}: {
	userId: string;
	providerId: string;
	accountId: string;
	hashedPassword?: string;
}) {
	return await db.account.create({
		data: {
			userId,
			accountId,
			providerId,
			password: hashedPassword,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});
}

export async function deleteMailboxById(id: string) {
	return await db.mailbox.delete({
		where: { id },
	});
}

export async function deleteAccountById(id: string) {
	return await db.account.delete({
		where: { id },
	});
}

export async function getMailboxesByUserId(userId: string) {
	return await db.mailbox.findMany({
		where: {
			userId,
		},
		// Oldest-connected first. Callers (e.g. the mailbox switcher) rely on
		// this order being stable — without it, `mailboxes[0]` is whatever
		// Postgres happens to return, which can silently change when a new
		// mailbox is connected.
		orderBy: {
			createdAt: "asc",
		},
	});
}

export async function getMailboxById(id: string) {
	return await db.mailbox.findUnique({
		where: {
			id,
		},
	});
}

export async function updateUser(
	user: Partial<z.infer<typeof UserSchema>> & { id: string },
) {
	return await db.user.update({
		where: {
			id: user.id,
		},
		data: user,
	});
}

// Threshold/cooldown for the password sign-in soft lockout (CASA 1.1.1).
// Exported so the auth hook and its tests share one source of truth.
export const LOGIN_LOCKOUT_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_COOLDOWN_MS = 15 * 60 * 1000;

/**
 * Increments the per-account failed-login counter and, once it reaches
 * LOGIN_LOCKOUT_MAX_ATTEMPTS, sets lockedUntil to start the cooldown.
 * Called from the better-auth `/sign-in/email` failure path.
 */
export async function recordFailedLoginAttempt(userId: string) {
	const user = await db.user.update({
		where: { id: userId },
		data: { failedLoginAttempts: { increment: 1 } },
		select: { failedLoginAttempts: true },
	});

	if (user.failedLoginAttempts >= LOGIN_LOCKOUT_MAX_ATTEMPTS) {
		await db.user.update({
			where: { id: userId },
			data: {
				lockedUntil: new Date(Date.now() + LOGIN_LOCKOUT_COOLDOWN_MS),
			},
		});
	}
}

/** Clears lockout state after a successful sign-in. */
export async function clearFailedLoginAttempts(userId: string) {
	await db.user.update({
		where: { id: userId },
		data: { failedLoginAttempts: 0, lockedUntil: null },
	});
}

/**
 * Stamp `firstSummaryViewedAt` the first time it is ever set for a user.
 * Returns `true` only on the call that actually flipped it from null, so the
 * caller can fire the once-per-lifetime `first_summary_viewed` event exactly
 * once. Concurrency-safe: the `firstSummaryViewedAt: null` filter means a
 * racing second call updates zero rows.
 */
export async function markFirstSummaryViewed(userId: string): Promise<boolean> {
	const { count } = await db.user.updateMany({
		where: {
			id: userId,
			firstSummaryViewedAt: null,
		},
		data: {
			firstSummaryViewedAt: new Date(),
		},
	});
	return count > 0;
}
