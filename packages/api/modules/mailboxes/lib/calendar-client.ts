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
