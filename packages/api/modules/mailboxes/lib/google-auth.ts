import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { decryptToken, encryptToken } from "@repo/utils/lib/token-crypto";
import { google } from "googleapis";

export async function revokeOAuthToken(accountId: string) {
	const account = await db.account.findUnique({
		where: { id: accountId },
	});

	const token = decryptToken(account?.refreshToken ?? account?.accessToken);

	if (!token) {
		logger.warn("No token to revoke", { accountId });
		return;
	}

	const oauth2 = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
	);

	try {
		await oauth2.revokeToken(token);
		logger.info("OAuth token revoked with Google", { accountId });
	} catch (error) {
		logger.warn("Failed to revoke OAuth token (proceeding with cleanup)", {
			accountId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

export async function getOAuth2Client(accountId: string) {
	const account = await db.account.findUnique({
		where: { id: accountId },
	});

	if (!account?.refreshToken) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "No refresh token — reconnect Gmail",
		});
	}

	const oauth2 = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
	);

	oauth2.setCredentials({
		access_token: decryptToken(account.accessToken),
		refresh_token: decryptToken(account.refreshToken),
		expiry_date: account.accessTokenExpiresAt?.getTime(),
	});

	// Persist refreshed tokens back to DB
	oauth2.on("tokens", async (tokens) => {
		logger.info("Google token refreshed", { accountId });
		await db.account.update({
			where: { id: accountId },
			data: {
				accessToken: tokens.access_token
					? encryptToken(tokens.access_token)
					: undefined,
				accessTokenExpiresAt: tokens.expiry_date
					? new Date(tokens.expiry_date)
					: undefined,
				...(tokens.refresh_token
					? { refreshToken: encryptToken(tokens.refresh_token) }
					: {}),
			},
		});
	});

	return oauth2;
}
