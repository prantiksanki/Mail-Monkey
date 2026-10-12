import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { encryptToken, isEncryptedToken } from "@repo/utils/lib/token-crypto";

// One-off migration: encrypts any Account.accessToken/refreshToken/idToken
// still stored in plaintext (AES-256-GCM, see packages/utils/lib/token-crypto.ts).
// Idempotent — rows whose values already look like `<iv>:<authTag>:<ciphertext>`
// are skipped, so this is safe to re-run.
async function main() {
	const accounts = await db.account.findMany({
		where: {
			OR: [
				{ accessToken: { not: null } },
				{ refreshToken: { not: null } },
				{ idToken: { not: null } },
			],
		},
		select: {
			id: true,
			accessToken: true,
			refreshToken: true,
			idToken: true,
		},
	});

	logger.info(`Found ${accounts.length} account(s) with token data`);

	let updated = 0;
	let skipped = 0;

	for (const account of accounts) {
		const data: Record<string, string> = {};

		if (account.accessToken && !isEncryptedToken(account.accessToken)) {
			data.accessToken = encryptToken(account.accessToken);
		}
		if (account.refreshToken && !isEncryptedToken(account.refreshToken)) {
			data.refreshToken = encryptToken(account.refreshToken);
		}
		if (account.idToken && !isEncryptedToken(account.idToken)) {
			data.idToken = encryptToken(account.idToken);
		}

		if (Object.keys(data).length === 0) {
			skipped++;
			continue;
		}

		await db.account.update({
			where: { id: account.id },
			data,
		});
		updated++;
	}

	logger.success(
		`Encrypted tokens for ${updated} account(s); ${skipped} already encrypted or empty.`,
	);
}

main();
