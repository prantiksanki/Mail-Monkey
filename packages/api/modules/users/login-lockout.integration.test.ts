/**
 * Integration tests for the password sign-in soft lockout (CASA 1.1.1).
 *
 * Requires a live Postgres database with the schema applied.
 * Set DATABASE_URL before running:
 *
 *   DATABASE_URL=postgresql://... pnpm --filter @repo/api test:integration
 */

import {
	clearFailedLoginAttempts,
	db,
	LOGIN_LOCKOUT_MAX_ATTEMPTS,
	recordFailedLoginAttempt,
} from "@repo/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDb ? describe : describe.skip;

maybeDescribe("login lockout — integration", () => {
	const email = "test-login-lockout@zeromail-test.invalid";
	let userId: string;

	beforeAll(async () => {
		await db.user.deleteMany({ where: { email } });
		const user = await db.user.create({
			data: {
				name: "Test Login Lockout",
				email,
				emailVerified: false,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
		userId = user.id;
	});

	afterAll(async () => {
		await db.user.deleteMany({ where: { email } });
	});

	beforeEach(async () => {
		await db.user.update({
			where: { id: userId },
			data: { failedLoginAttempts: 0, lockedUntil: null },
		});
	});

	it("increments the failure counter without locking below the threshold", async () => {
		for (let i = 0; i < LOGIN_LOCKOUT_MAX_ATTEMPTS - 1; i++) {
			await recordFailedLoginAttempt(userId);
		}

		const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
		expect(user.failedLoginAttempts).toBe(LOGIN_LOCKOUT_MAX_ATTEMPTS - 1);
		expect(user.lockedUntil).toBeNull();
	});

	it("locks the account once the threshold is reached", async () => {
		for (let i = 0; i < LOGIN_LOCKOUT_MAX_ATTEMPTS; i++) {
			await recordFailedLoginAttempt(userId);
		}

		const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
		expect(user.failedLoginAttempts).toBe(LOGIN_LOCKOUT_MAX_ATTEMPTS);
		expect(user.lockedUntil).not.toBeNull();
		expect(user.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
	});

	it("clears the counter and lockout on a successful sign-in", async () => {
		for (let i = 0; i < LOGIN_LOCKOUT_MAX_ATTEMPTS; i++) {
			await recordFailedLoginAttempt(userId);
		}

		await clearFailedLoginAttempts(userId);

		const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
		expect(user.failedLoginAttempts).toBe(0);
		expect(user.lockedUntil).toBeNull();
	});
});
