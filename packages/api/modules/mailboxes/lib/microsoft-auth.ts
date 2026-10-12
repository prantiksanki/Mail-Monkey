import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { decryptToken, encryptToken } from "@repo/utils/lib/token-crypto";

export async function getMicrosoftAccessToken(
	accountId: string,
): Promise<string> {
	const account = await db.account.findUnique({ where: { id: accountId } });

	const refreshToken = decryptToken(account?.refreshToken);
	if (!refreshToken) {
		throw new ORPCError("UNAUTHORIZED", {
			message:
				"No Microsoft refresh token — please reconnect your Outlook mailbox.",
		});
	}

	// Return cached token if it's still valid (with 60-second buffer)
	if (
		account?.accessToken &&
		account.accessTokenExpiresAt &&
		account.accessTokenExpiresAt > new Date(Date.now() + 60_000)
	) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by the accessToken truthy check above
		return decryptToken(account.accessToken)!;
	}

	const clientId = process.env.MICROSOFT_CLIENT_ID;
	const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error(
			"MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be set",
		);
	}

	const tenantId = process.env.MICROSOFT_TENANT_ID ?? "common";
	const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

	const params = new URLSearchParams({
		client_id: clientId,
		client_secret: clientSecret,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
		scope: "https://graph.microsoft.com/.default offline_access",
	});

	const res = await fetch(url, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: params.toString(),
	});

	if (!res.ok) {
		const errorData = (await res.json().catch(() => ({}))) as {
			error?: string;
		};
		logger.warn("[microsoft-auth] Token refresh failed", {
			accountId,
			error: errorData,
		});

		if (
			errorData.error === "invalid_grant" ||
			errorData.error === "invalid_client"
		) {
			throw new ORPCError("UNAUTHORIZED", {
				message:
					"Outlook connection expired — please reconnect your mailbox.",
			});
		}
		throw new Error(
			`Microsoft token refresh failed: ${JSON.stringify(errorData)}`,
		);
	}

	const data = (await res.json()) as {
		access_token: string;
		expires_in: number;
		refresh_token?: string;
	};

	// Persist new tokens — refresh tokens rotate with every response
	await db.account.update({
		where: { id: accountId },
		data: {
			accessToken: encryptToken(data.access_token),
			accessTokenExpiresAt: new Date(Date.now() + data.expires_in * 1000),
			...(data.refresh_token
				? { refreshToken: encryptToken(data.refresh_token) }
				: {}),
		},
	});

	logger.info("[microsoft-auth] Access token refreshed", { accountId });
	return data.access_token;
}
