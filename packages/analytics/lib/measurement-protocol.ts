import { randomUUID } from "node:crypto";
import { logger } from "@repo/logs";
import { getAppEnvironment, isStagingEnvironment } from "@repo/utils";

const GA4_COLLECT_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA4_DEBUG_ENDPOINT = "https://www.google-analytics.com/debug/mp/collect";

// GA4 drops events with no engagement signal from standard reports, so every
// Measurement Protocol event needs a non-zero engagement_time_msec.
const MIN_ENGAGEMENT_TIME_MSEC = 1;
const REQUEST_TIMEOUT_MSEC = 5000;

export interface ServerEventInput {
	/** GA4 event name, e.g. "sign_up", "gmail_connect". */
	name: string;
	/** Event params. Merged with engagement_time_msec / session_id. */
	params?: Record<string, unknown>;
	/**
	 * GA4 client id from the visitor's `_ga` cookie. When absent the event is
	 * still sent with a random id so it is counted, just not joined to the
	 * visitor's web session (no campaign / channel attribution).
	 */
	clientId?: string;
	/** GA4 session id from the `_ga_<STREAM>` cookie. Improves report attribution. */
	sessionId?: string;
	/** Application user id, surfaced in GA4 User-ID reports. */
	userId?: string;
}

interface GaCookieValues {
	clientId?: string;
	sessionId?: string;
}

/**
 * Pull the GA4 client id and session id out of a raw `Cookie` request header.
 *
 * - `_ga` looks like `GA1.1.1234567890.1700000000`; the client id is everything
 *   after the `GA<version>.<domain-depth>.` prefix.
 * - `_ga_<STREAM>` looks like `GS1.1.1700000000.1.1.1700000123.0.0.0`; the
 *   session id is the third dot-separated field.
 *
 * Best effort: returns an empty object when the cookies are missing or malformed
 * (ad-blockers, no gtag yet, server-to-server calls).
 */
export function parseGaCookies(
	cookieHeader: string | null | undefined,
): GaCookieValues {
	if (!cookieHeader) {
		return {};
	}

	const cookies = new Map<string, string>();
	for (const part of cookieHeader.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) {
			continue;
		}
		const key = part.slice(0, eq).trim();
		const value = part.slice(eq + 1).trim();
		if (key) {
			cookies.set(key, value);
		}
	}

	const result: GaCookieValues = {};

	const ga = cookies.get("_ga");
	const gaMatch = ga?.match(/^GA\d+\.\d+\.(.+)$/);
	if (gaMatch) {
		result.clientId = gaMatch[1];
	}

	for (const [key, value] of cookies) {
		if (!key.startsWith("_ga_")) {
			continue;
		}
		const fields = value.split(".");
		if (fields.length >= 3 && fields[2]) {
			result.sessionId = fields[2];
		}
		break;
	}

	return result;
}

/**
 * Send a single event to GA4 via the Measurement Protocol.
 *
 * Fire-and-forget: this never throws and never rejects. A missing config or a
 * failed request is logged and swallowed so it can't break signup, OAuth, or a
 * payment webhook. Follows the resilience pattern in
 * `packages/auth/lib/sequenzy.ts`.
 *
 * No-op on staging (`NEXT_PUBLIC_APP_ENV=staging`) — staging traffic is
 * development activity, not real usage, and shouldn't be reported to GA4.
 */
export async function trackServerEvent(input: ServerEventInput): Promise<void> {
	if (isStagingEnvironment()) {
		return;
	}

	const measurementId = process.env.GA4_MEASUREMENT_ID;
	const apiSecret = process.env.GA4_API_SECRET;

	if (!measurementId || !apiSecret) {
		logger.warn(
			"GA4_MEASUREMENT_ID / GA4_API_SECRET not set - skipping server event",
			{ event: input.name },
		);
		return;
	}

	const useDebugEndpoint = process.env.GA4_USE_DEBUG_ENDPOINT === "true";
	const endpoint = useDebugEndpoint
		? GA4_DEBUG_ENDPOINT
		: GA4_COLLECT_ENDPOINT;

	const params: Record<string, unknown> = {
		...input.params,
		engagement_time_msec: MIN_ENGAGEMENT_TIME_MSEC,
		// Authoritative — set after the spread so a caller can't overwrite it.
		environment: getAppEnvironment(),
	};
	if (input.sessionId) {
		params.session_id = input.sessionId;
	}

	const body = {
		client_id: input.clientId ?? randomUUID(),
		...(input.userId ? { user_id: input.userId } : {}),
		events: [{ name: input.name, params }],
	};

	try {
		const response = await fetch(
			`${endpoint}?measurement_id=${encodeURIComponent(
				measurementId,
			)}&api_secret=${encodeURIComponent(apiSecret)}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MSEC),
			},
		);

		if (useDebugEndpoint) {
			logger.info("GA4 Measurement Protocol debug response", {
				event: input.name,
				validation: await response.text(),
			});
			return;
		}

		// GA4 /mp/collect returns 204 on success and never a body.
		if (!response.ok) {
			logger.warn("GA4 Measurement Protocol request failed", {
				event: input.name,
				status: response.status,
				body: await response.text(),
			});
		}
	} catch (error) {
		logger.warn("Failed to call GA4 Measurement Protocol", {
			event: input.name,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
