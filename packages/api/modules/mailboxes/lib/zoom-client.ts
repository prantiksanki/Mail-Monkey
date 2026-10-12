import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { decryptToken, encryptToken } from "@repo/utils/lib/token-crypto";

const ZOOM_TOKEN_URL = "https://zoom.us/oauth/token";
const ZOOM_API_BASE = "https://api.zoom.us/v2";
// Refresh slightly before the real expiry so a request never races the boundary.
const EXPIRY_BUFFER_MS = 60_000;

export interface CreatedMeeting {
	eventId: string;
	meetLink: string;
	htmlLink: string | null;
	start: string | null;
	end: string | null;
}

/**
 * Outcome of a Zoom meeting creation, classified so the create-meeting endpoint
 * can return a uniform result for both Google Meet and Zoom:
 *  - ok             → the meeting link
 *  - needsReconnect → no Zoom connection, or the token/scope was rejected
 *  - error          → an unexpected/transient failure
 */
export type ZoomResult =
	| { status: "ok"; meeting: CreatedMeeting }
	| { status: "needsReconnect" }
	| { status: "error"; message: string };

function basicAuthHeader() {
	const clientId = process.env.ZOOM_CLIENT_ID;
	const clientSecret = process.env.ZOOM_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error(
			"ZOOM_CLIENT_ID / ZOOM_CLIENT_SECRET are not configured",
		);
	}
	return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function getZoomAccount(userId: string) {
	return db.account.findFirst({
		where: { userId, providerId: "zoom" },
		orderBy: { createdAt: "desc" },
	});
}

export async function hasZoomConnection(userId: string): Promise<boolean> {
	const account = await getZoomAccount(userId);
	return !!account?.refreshToken;
}

/**
 * Connection state for the settings UI. `configured` reflects whether the OAuth
 * provider is registered in this environment (it only is when creds are set),
 * so the UI can disable "Connect" until Zoom is configured.
 */
export async function getZoomConnectionStatus(userId: string) {
	return {
		connected: await hasZoomConnection(userId),
		configured: !!(
			process.env.ZOOM_CLIENT_ID && process.env.ZOOM_CLIENT_SECRET
		),
	};
}

/** Removes the stored Zoom OAuth account (and its tokens) for a user. */
export async function disconnectZoom(userId: string) {
	await db.account.deleteMany({
		where: { userId, providerId: "zoom" },
	});
	return { success: true };
}

/**
 * Removes the Zoom OAuth account for a Zoom user who uninstalled the app from
 * the Zoom side (deauthorization webhook). Matched on Zoom's own user id, which
 * Better Auth stores as `account.accountId`. Returns the number of rows removed.
 */
export async function deleteZoomAccountsByZoomUserId(
	zoomUserId: string,
): Promise<number> {
	const { count } = await db.account.deleteMany({
		where: { providerId: "zoom", accountId: zoomUserId },
	});
	return count;
}

/**
 * Returns a valid Zoom access token for the user, refreshing (and persisting)
 * it when the stored one is expired. Mirrors the Google refresh-and-persist in
 * `google-auth.ts`. Throws `ORPCError("UNAUTHORIZED")` when the user has no Zoom
 * connection or the refresh token is rejected, which callers surface as
 * "reconnect Zoom".
 */
export async function getZoomAccessToken(userId: string): Promise<string> {
	const account = await getZoomAccount(userId);
	const refreshToken = decryptToken(account?.refreshToken);
	if (!refreshToken) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "No Zoom connection — connect Zoom",
		});
	}

	const stillValid =
		account?.accessToken &&
		account.accessTokenExpiresAt &&
		account.accessTokenExpiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now();
	if (stillValid && account?.accessToken) {
		// biome-ignore lint/style/noNonNullAssertion: guarded by the accessToken truthy check above
		return decryptToken(account.accessToken)!;
	}

	const res = await fetch(ZOOM_TOKEN_URL, {
		method: "POST",
		headers: {
			Authorization: basicAuthHeader(),
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
		}),
	});

	const data = (await res.json().catch(() => null)) as
		| { access_token: string; refresh_token?: string; expires_in?: number }
		| { error: string; reason?: string }
		| null;

	if (!res.ok || !data || "error" in data) {
		const message =
			data && "error" in data ? data.error : `HTTP ${res.status}`;
		logger.error("[zoom] token refresh failed", { userId, message });
		// invalid_grant → the refresh token was revoked/expired → force reconnect.
		throw new ORPCError("UNAUTHORIZED", {
			message: `Zoom token refresh failed: ${message}`,
		});
	}

	await db.account.update({
		// biome-ignore lint/style/noNonNullAssertion: getZoomAccount already validated the account exists above
		where: { id: account!.id },
		data: {
			accessToken: encryptToken(data.access_token),
			accessTokenExpiresAt: data.expires_in
				? new Date(Date.now() + data.expires_in * 1000)
				: undefined,
			...(data.refresh_token
				? { refreshToken: encryptToken(data.refresh_token) }
				: {}),
		},
	});

	return data.access_token;
}

/** Classifies a thrown Zoom error into a {@link ZoomResult}. */
export function classifyZoomError(error: unknown): ZoomResult {
	if (error instanceof ORPCError) {
		// getZoomAccessToken throws UNAUTHORIZED when there is no/invalid token.
		return { status: "needsReconnect" };
	}
	const message = error instanceof Error ? error.message : String(error);
	return { status: "error", message };
}

/**
 * Creates a scheduled Zoom meeting for the user and returns its join URL, shaped
 * like {@link CreatedMeeting} so the create-meeting endpoint returns a uniform
 * result for both Google Meet and Zoom. `start`/`end` are ISO strings; Zoom
 * interprets a trailing `Z` as GMT, so no timezone field is needed.
 */
export async function createZoomMeeting(
	userId: string,
	opts: {
		summary: string;
		startIso: string;
		endIso: string;
		description?: string;
	},
): Promise<CreatedMeeting> {
	const accessToken = await getZoomAccessToken(userId);

	const durationMinutes = Math.max(
		1,
		Math.round(
			(new Date(opts.endIso).getTime() -
				new Date(opts.startIso).getTime()) /
				60000,
		),
	);

	const res = await fetch(`${ZOOM_API_BASE}/users/me/meetings`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			topic: opts.summary,
			type: 2, // scheduled meeting
			start_time: opts.startIso,
			duration: durationMinutes,
			agenda: opts.description?.slice(0, 2000),
			settings: {
				join_before_host: true,
				waiting_room: false,
			},
		}),
	});

	const data = (await res.json().catch(() => null)) as
		| { id: number; join_url: string; start_time?: string }
		| { message?: string; code?: number }
		| null;

	if (!res.ok || !data || !("join_url" in data)) {
		const message =
			data && "message" in data ? data.message : `HTTP ${res.status}`;
		logger.error("[zoom] create meeting failed", {
			userId,
			status: res.status,
			message,
		});
		// 401 → token/scope problem → surface as reconnect.
		if (res.status === 401) {
			throw new ORPCError("UNAUTHORIZED", {
				message: message ?? "Zoom unauthorized",
			});
		}
		throw new Error(`Zoom create meeting failed: ${message}`);
	}

	return {
		eventId: String(data.id),
		meetLink: data.join_url,
		htmlLink: data.join_url,
		start: data.start_time ?? opts.startIso,
		end: opts.endIso,
	};
}
