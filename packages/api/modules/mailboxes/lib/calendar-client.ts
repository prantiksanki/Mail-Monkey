import { ORPCError } from "@orpc/server";
import { google } from "googleapis";
import { getOAuth2Client } from "./google-auth";

export interface CalendarEvent {
	id: string;
	summary: string | null;
	start: string | null;
	end: string | null;
	location: string | null;
	isAllDay: boolean;
}

/**
 * Outcome of a calendar fetch, classified so callers (the calendar endpoint and
 * the AI assistant) can tell the user the *right* thing instead of a vague
 * "unavailable":
 *  - ok            → events (possibly empty — the user simply has none)
 *  - needsReconnect→ auth/scope problem; the user must reconnect Google
 *  - serviceDisabled→ the Calendar API is disabled in the GCP project
 *  - error         → an unexpected/transient failure
 */
export type CalendarResult =
	| { status: "ok"; events: CalendarEvent[] }
	| { status: "needsReconnect" }
	| { status: "serviceDisabled" }
	| { status: "error"; message: string };

/**
 * Classifies a thrown calendar error into a {@link CalendarResult}. Mirrors the
 * branching the calendar endpoint has always used, kept in one place so the
 * endpoint and the assistant agree.
 */
export function classifyCalendarError(error: unknown): CalendarResult {
	if (error instanceof ORPCError) {
		// getOAuth2Client throws UNAUTHORIZED when there is no refresh token.
		return { status: "needsReconnect" };
	}
	const msg = error instanceof Error ? error.message : String(error);
	const status =
		(error as { status?: number; code?: number })?.status ??
		(error as { status?: number; code?: number })?.code;

	const isServiceDisabled =
		status === 403 &&
		(msg.includes("accessNotConfigured") ||
			msg.includes("SERVICE_DISABLED") ||
			msg.includes("has not been used") ||
			msg.includes("has not been enabled"));
	if (isServiceDisabled) {
		return { status: "serviceDisabled" };
	}

	if (
		status === 401 ||
		status === 403 ||
		msg.includes("invalid_grant") ||
		msg.includes("insufficientPermissions") ||
		msg.includes("insufficient authentication scopes") ||
		msg.includes("Request had insufficient") ||
		msg.includes("UNAUTHORIZED")
	) {
		return { status: "needsReconnect" };
	}

	return { status: "error", message: msg };
}

/**
 * Fetches upcoming events and returns a classified {@link CalendarResult}
 * (never throws). Retries once on a transient `error` — a single blip (e.g. a
 * token refresh racing the request) should not surface as "calendar
 * unavailable" when a retry would succeed. Auth and service-disabled outcomes
 * are not retried, since retrying can't fix them.
 */
export async function getCalendarResult(
	accountId: string,
	opts: { timeMin?: string; timeMax?: string; maxResults?: number } = {},
): Promise<CalendarResult> {
	for (let attempt = 0; attempt < 2; attempt++) {
		try {
			const events = await listUpcomingEvents(accountId, opts);
			return { status: "ok", events };
		} catch (error) {
			const result = classifyCalendarError(error);
			if (result.status === "error" && attempt === 0) {
				continue; // one retry for a transient failure
			}
			return result;
		}
	}
	// Unreachable, but satisfies the type checker.
	return { status: "error", message: "calendar fetch failed" };
}

async function getCalendar(accountId: string) {
	const auth = await getOAuth2Client(accountId);
	return google.calendar({ version: "v3", auth });
}

function extractGaxiosError(error: unknown): {
	status?: number;
	message: string;
} {
	if (error && typeof error === "object") {
		const e = error as Record<string, unknown>;
		const status = (e.status ?? e.code) as number | undefined;
		const message = (e.message as string) ?? String(error);
		const nested = (e.response as Record<string, unknown>)?.data as
			| Record<string, unknown>
			| undefined;
		const nestedMsg = (nested?.error as Record<string, unknown>)?.message as
			| string
			| undefined;
		return { status, message: nestedMsg ?? message };
	}
	return { message: String(error) };
}

export interface CreatedMeeting {
	eventId: string;
	meetLink: string;
	htmlLink: string | null;
	start: string | null;
	end: string | null;
}

/**
 * Creates a Google Calendar event with a Google Meet conference attached and
 * returns the generated Meet link. Reuses the same OAuth client as the rest of
 * the calendar integration.
 *
 * NOTE: this requires the `calendar.events` (write) scope, which the app
 * requests on new Google connections. Accounts connected before that scope
 * was added won't have it on their stored token — Google returns a 403
 * "insufficient authentication scopes" until the user reconnects, surfaced by
 * classifyCalendarError as `needsReconnect`.
 */
export async function createGoogleMeet(
	accountId: string,
	opts: {
		summary: string;
		startIso: string;
		endIso: string;
		attendees?: string[];
		description?: string;
	},
): Promise<CreatedMeeting> {
	const calendar = await getCalendar(accountId);
	try {
		const res = await calendar.events.insert({
			calendarId: "primary",
			conferenceDataVersion: 1,
			sendUpdates: "all",
			requestBody: {
				summary: opts.summary,
				description: opts.description,
				start: { dateTime: opts.startIso },
				end: { dateTime: opts.endIso },
				attendees: opts.attendees?.map((email) => ({ email })),
				conferenceData: {
					createRequest: {
						requestId: crypto.randomUUID(),
						conferenceSolutionKey: { type: "hangoutsMeet" },
					},
				},
			},
		});

		const data = res.data;
		const meetLink =
			data.hangoutLink ??
			data.conferenceData?.entryPoints?.find(
				(e) => e.entryPointType === "video",
			)?.uri ??
			null;

		if (!meetLink) {
			throw new Error("Google did not return a Meet link");
		}

		return {
			eventId: data.id ?? "",
			meetLink,
			htmlLink: data.htmlLink ?? null,
			start: data.start?.dateTime ?? null,
			end: data.end?.dateTime ?? null,
		};
	} catch (error) {
		const { status, message } = extractGaxiosError(error);
		console.error(
			`[calendar-client] createGoogleMeet failed — status=${status} message=${message}`,
		);
		throw error;
	}
}

export interface CreatedCalendarEvent {
	eventId: string;
	htmlLink: string | null;
	start: string | null;
	end: string | null;
}

/**
 * Creates a plain Google Calendar event (no Meet/conference link attached).
 * Same OAuth client and write-scope caveat as {@link createGoogleMeet}.
 *
 * Pass `allDay` with plain `YYYY-MM-DD` dates for a full-day event (e.g. a
 * birthday or holiday) instead of `startIso`/`endIso` — Google Calendar
 * represents these with a `date` field rather than `dateTime`, and `end.date`
 * must be exclusive (the day after the last all-day date).
 */
export async function createCalendarEvent(
	accountId: string,
	opts:
		| {
				summary: string;
				startIso: string;
				endIso: string;
				attendees?: string[];
				description?: string;
				allDay?: false;
		  }
		| {
				summary: string;
				startDate: string;
				endDate: string;
				attendees?: string[];
				description?: string;
				allDay: true;
		  },
): Promise<CreatedCalendarEvent> {
	const calendar = await getCalendar(accountId);
	try {
		const res = await calendar.events.insert({
			calendarId: "primary",
			sendUpdates: "all",
			requestBody: {
				summary: opts.summary,
				description: opts.description,
				start: opts.allDay
					? { date: opts.startDate }
					: { dateTime: opts.startIso },
				end: opts.allDay
					? { date: opts.endDate }
					: { dateTime: opts.endIso },
				attendees: opts.attendees?.map((email) => ({ email })),
			},
		});

		const data = res.data;
		return {
			eventId: data.id ?? "",
			htmlLink: data.htmlLink ?? null,
			start: data.start?.dateTime ?? data.start?.date ?? null,
			end: data.end?.dateTime ?? data.end?.date ?? null,
		};
	} catch (error) {
		const { status, message } = extractGaxiosError(error);
		console.error(
			`[calendar-client] createCalendarEvent failed — status=${status} message=${message}`,
		);
		throw error;
	}
}

export async function listUpcomingEvents(
	accountId: string,
	opts: { timeMin?: string; timeMax?: string; maxResults?: number } = {},
): Promise<CalendarEvent[]> {
	const calendar = await getCalendar(accountId);
	const now = new Date();
	const defaultMax = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	try {
		const res = await calendar.events.list({
			calendarId: "primary",
			timeMin: opts.timeMin ?? now.toISOString(),
			timeMax: opts.timeMax ?? defaultMax.toISOString(),
			maxResults: opts.maxResults ?? 50,
			singleEvents: true,
			orderBy: "startTime",
		});

		return (res.data.items ?? []).map((event) => ({
			id: event.id ?? "",
			summary: event.summary ?? null,
			start: event.start?.dateTime ?? event.start?.date ?? null,
			end: event.end?.dateTime ?? event.end?.date ?? null,
			location: event.location ?? null,
			isAllDay: !event.start?.dateTime,
		}));
	} catch (error) {
		const { status, message } = extractGaxiosError(error);
		console.error(
			`[calendar-client] events.list failed — status=${status} message=${message}`,
		);
		throw error;
	}
}
