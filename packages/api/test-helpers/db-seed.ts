import { db } from "@repo/database";

export interface TestSeed {
	userId: string;
	accountId: string;
	mailboxId: string;
	otherUserId: string;
}

/**
 * Creates a minimal User → Account → Mailbox chain for integration tests.
 * Call teardownTestSeed in afterAll to remove the rows.
 */
export async function setupTestSeed(suffix: string): Promise<TestSeed> {
	const email = `test-${suffix}@zeromail-test.invalid`;
	const otherEmail = `other-${suffix}@zeromail-test.invalid`;

	// Remove any leftover rows from a previous run that didn't clean up
	await db.user.deleteMany({
		where: { email: { in: [email, otherEmail] } },
	});

	const user = await db.user.create({
		data: {
			name: `Test User ${suffix}`,
			email,
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	const account = await db.account.create({
		data: {
			accountId: `acc-${suffix}`,
			providerId: "google",
			userId: user.id,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	const mailbox = await db.mailbox.create({
		data: {
			userId: user.id,
			accountId: account.id,
			email,
			provider: "GOOGLE",
		},
	});

	// A second user with no ownership over the mailbox above
	const otherUser = await db.user.create({
		data: {
			name: `Other User ${suffix}`,
			email: `other-${suffix}@zeromail-test.invalid`,
			emailVerified: false,
			createdAt: new Date(),
			updatedAt: new Date(),
		},
	});

	return {
		userId: user.id,
		accountId: account.id,
		mailboxId: mailbox.id,
		otherUserId: otherUser.id,
	};
}

export async function teardownTestSeed(seed: TestSeed): Promise<void> {
	// Cascade deletes handle account + mailbox + rules when the user is deleted
	await db.user.deleteMany({
		where: { id: { in: [seed.userId, seed.otherUserId] } },
	});
	await db.$disconnect();
}
