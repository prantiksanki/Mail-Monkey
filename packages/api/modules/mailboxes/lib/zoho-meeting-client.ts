import { ORPCError } from "@orpc/server";
import { db } from "@repo/database";
import { logger } from "@repo/logs";
import { decryptToken, encryptToken } from "@repo/utils/lib/token-crypto";

// Zoho is data-centre scoped: an account created in the EU/IN/AU/JP DC only
// answers on that DC's domains, so both are overridable via env. Defaults are
// the US DC. Keep these in sync with the OAuth URLs in `packages/auth/auth.ts`.
const accountsDomain = () =>
	process.env.ZOHO_ACCOUNTS_DOMAIN ?? "https://accounts.zoho.com";
const meetingDomain = () =>
	process.env.ZOHO_MEETING_DOMAIN ?? "https://meeting.zoho.com";

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
 * Outcome of a Zoho Meeting creation, classified so the create-meeting endpoint
 * can return a uniform result across Google Meet, Zoom and Zoho:
 *  - ok             → the meeting link
 *  - needsReconnect → no Zoho connection, or the token/scope was rejected
 *  - error          → an unexpected/transient failure
 */
export type ZohoResult =
	| { status: "ok"; meeting: CreatedMeeting }
	| { status: "needsReconnect" }
	| { status: "error"; message: string };

async function getZohoAccount(userId: string) {
	return db.account.findFirst({
		where: { userId, providerId: "zoho" },
		orderBy: { createdAt: "desc" },
	});
}

export async function hasZohoConnection(userId: string): Promise<boolean> {
	const account = await getZohoAccount(userId);
	return !!account?.refreshToken;
}

/**
 * Returns a valid Zoho access token for the user, refreshing (and persisting) it
 * when the stored one is expired. Mirrors `zoom-client.ts`. Throws
 * `ORPCError("UNAUTHORIZED")` when the user has no Zoho connection or the refresh
 * token is rejected, which callers surface as "reconnect Zoho".
 */
export async function getZohoAccessToken(userId: string): Promise<string> {
	const account = await getZohoAccount(userId);
	const refreshToken = decryptToken(account?.refreshToken);
	if (!refreshToken) {
		throw new ORPCError("UNAUTHORIZED", {
			message: "No Zoho connection — connect Zoho",
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

	const clientId = process.env.ZOHO_CLIENT_ID;
	const clientSecret = process.env.ZOHO_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error(
			"ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET are not configured",
		);
	}

	// Zoho takes the client credentials as form params; it has no Basic-auth mode.
	const res = await fetch(`${accountsDomain()}/oauth/v2/token`, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			grant_type: "refresh_token",
			refresh_token: refreshToken,
			client_id: clientId,
			client_secret: clientSecret,
		}),
	});

	// Zoho reports OAuth failures as HTTP 200 with an `error` field, so the body
	// has to be inspected rather than relying on the status alone.
	const data = (await res.json().catch(() => null)) as
		| { access_token: string; expires_in?: number }
		| { error: string }
		| null;

	if (!res.ok || !data || "error" in data) {
		const message =
			data && "error" in data ? data.error : `HTTP ${res.status}`;
		logger.error("[zoho] token refresh failed", { userId, message });
		// invalid_code/invalid_client → refresh token revoked → force reconnect.
		throw new ORPCError("UNAUTHORIZED", {
			message: `Zoho token refresh failed: ${message}`,
		});
	}

	await db.account.update({
		// biome-ignore lint/style/noNonNullAssertion: getZohoAccount already validated the account exists above
		where: { id: account!.id },
		data: {
			accessToken: encryptToken(data.access_token),
			accessTokenExpiresAt: data.expires_in
				? new Date(Date.now() + data.expires_in * 1000)
				: undefined,
			// Zoho does not return a new refresh token on refresh; the original is
			// permanent until revoked, so it is deliberately left untouched.
		},
	});

	return data.access_token;
}

/** Classifies a thrown Zoho error into a {@link ZohoResult}. */
export function classifyZohoError(error: unknown): ZohoResult {
	if (error instanceof ORPCError) {
		// getZohoAccessToken throws UNAUTHORIZED when there is no/invalid token.
		return { status: "needsReconnect" };
	}
	const message = error instanceof Error ? error.message : String(error);
	return { status: "error", message };
}

/**
 * Zoho's session API takes a display-style local time plus a separate timezone
 * field rather than an ISO timestamp. We always send UTC so the two agree
 * regardless of the presenter's Zoho profile timezone.
 * Produces e.g. "Jul 16, 2026 03:00 PM".
 */
function formatZohoStartTime(iso: string): string {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: "UTC",
		month: "short",
		day: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	}).formatToParts(new Date(iso));
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? "";
	return `${get("month")} ${get("day")}, ${get("year")} ${get("hour")}:${get("minute")} ${get("dayPeriod")}`;
}

/**
 * Zoho scopes every meeting endpoint under the org id (`zsoid`), and the create
 * call needs the presenter's `zuid`, so both are fetched from the current user
 * before a session can be created.
 */
async function getZohoUserDetails(
	accessToken: string,
): Promise<{ zsoid: string; zuid: string }> {
	const res = await fetch(`${meetingDomain()}/api/v2/user.json`, {
		headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
	});

	const data = (await res.json().catch(() => null)) as {
		userDetails?: { zsoid?: number | string; zuid?: number | string };
	} | null;

	const zsoid = data?.userDetails?.zsoid;
	const zuid = data?.userDetails?.zuid;

	if (!res.ok || zsoid === undefined || zuid === undefined) {
		logger.error("[zoho] user lookup failed", { status: res.status });
		if (res.status === 401) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Zoho unauthorized",
			});
		}
		throw new Error(`Zoho user lookup failed: HTTP ${res.status}`);
	}

	return { zsoid: String(zsoid), zuid: String(zuid) };
}

/**
 * Creates a scheduled Zoho meeting for the user and returns its join URL, shaped
 * like {@link CreatedMeeting} so the create-meeting endpoint returns a uniform
 * result across providers.
 */
export async function createZohoMeeting(
	userId: string,
	opts: {
		summary: string;
		startIso: string;
		endIso: string;
		description?: string;
	},
): Promise<CreatedMeeting> {
	const accessToken = await getZohoAccessToken(userId);
	const { zsoid, zuid } = await getZohoUserDetails(accessToken);

	const durationMinutes = Math.max(
		1,
		Math.round(
			(new Date(opts.endIso).getTime() -
				new Date(opts.startIso).getTime()) /
				60000,
		),
	);

	const res = await fetch(
		`${meetingDomain()}/api/v2/${zsoid}/sessions.json`,
		{
			method: "POST",
			headers: {
				Authorization: `Zoho-oauthtoken ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				session: {
					topic: opts.summary,
					agenda: opts.description?.slice(0, 2000),
					presenter: zuid,
					startTime: formatZohoStartTime(opts.startIso),
					duration: durationMinutes,
					timezone: "UTC",
				},
			}),
		},
	);

	const data = (await res.json().catch(() => null)) as {
		session?: { meetingKey?: number | string; joinLink?: string };
		message?: string;
	} | null;

	const joinLink = data?.session?.joinLink;

	if (!res.ok || !joinLink) {
		const message = data?.message ?? `HTTP ${res.status}`;
		logger.error("[zoho] create meeting failed", {
			userId,
			status: res.status,
			message,
		});
		// 401 → token/scope problem → surface as reconnect.
		if (res.status === 401) {
			throw new ORPCError("UNAUTHORIZED", {
				message: message ?? "Zoho unauthorized",
			});
		}
		throw new Error(`Zoho create meeting failed: ${message}`);
	}

	return {
		eventId: String(data?.session?.meetingKey ?? ""),
		meetLink: joinLink,
		htmlLink: joinLink,
		start: opts.startIso,
		end: opts.endIso,
	};
}
