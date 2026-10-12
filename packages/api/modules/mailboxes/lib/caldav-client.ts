import ICAL from "ical.js";
import {
	createAccount,
	createCalendarObject,
	fetchCalendarObjects,
	fetchCalendars,
	getBasicAuthHeaders,
} from "tsdav";
import type { CalendarEvent } from "./calendar-client";
import { getImapCredentials, type ImapCredentials } from "./imap-client";

/**
 * Calendar for custom (IMAP/SMTP) mailboxes. Providers like Zoho, iCloud and
 * Fastmail expose calendars over CalDAV, and the mailbox's own email +
 * (app) password authenticate it — so no separate OAuth connection is needed.
 * Read-only for now.
 */

export type CalDavResult =
	| { status: "ok"; events: CalendarEvent[] }
	| { status: "error"; message: string };

const MAX_EVENTS = 500;
const MAX_OCCURRENCES_PER_SERIES = 1000;
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * One way of reaching the account's calendars. Without `explicit`, tsdav finds
 * the principal/home itself via standard CalDAV discovery; with it, discovery
 * is skipped and the URLs are named directly, which providers with non-standard
 * or broken discovery (Zoho's regional .well-known redirects to a closed port)
 * need.
 */
interface ExplicitUrls {
	rootUrl: string;
	principalUrl: string;
	homeUrl: string;
}

interface Candidate {
	label: string;
	serverUrl: string;
	explicit?: ExplicitUrls;
	/** Skip tsdav: list/report/put directly against this calendar home. */
	manualHomeUrl?: string;
	/** Asks the server for the URLs (needs the login), instead of guessing. */
	resolve?: (headers: Record<string, string>) => Promise<ExplicitUrls>;
}

/**
 * Candidates for the account, most likely first. The IMAP host tells us the
 * provider (and, for Zoho, the data-centre region: the calendar lives on the
 * same regional domain as the mailbox).
 */
function candidatesFor(creds: ImapCredentials): Candidate[] {
	const host = creds.imapHost.toLowerCase();
	const zoho = host.match(/zoho\.([a-z.]+)$/);
	if (zoho) {
		const root = `https://calendar.zoho.${zoho[1]}`;
		const who = encodeURIComponent(creds.username);
		return [
			{
				label: "zoho-manual",
				serverUrl: root,
				manualHomeUrl: `${root}/caldav/${who}/events/`,
			},
			{
				label: "zoho-probe",
				serverUrl: root,
				resolve: (headers) =>
					discoverZoho(root, creds.username, headers),
			},
			{
				label: "zoho-direct",
				serverUrl: root,
				explicit: {
					rootUrl: `${root}/`,
					principalUrl: `${root}/caldav/${who}/user/`,
					homeUrl: `${root}/caldav/${who}/events/`,
				},
			},
			{ label: "zoho-discovery", serverUrl: root },
		];
	}
	if (host.endsWith("mail.me.com") || host.endsWith("icloud.com")) {
		return [{ label: "icloud", serverUrl: "https://caldav.icloud.com" }];
	}
	if (host.endsWith("fastmail.com")) {
		return [
			{ label: "fastmail", serverUrl: "https://caldav.fastmail.com" },
		];
	}
	if (host.includes("yahoo.")) {
		return [
			{ label: "yahoo", serverUrl: "https://caldav.calendar.yahoo.com" },
		];
	}
	// Unknown provider: try the standard discovery on the mail host's domain
	// and on the account's own domain.
	const urls: string[] = [];
	const mailDomain = host.replace(/^(imap|imaps|mail|pop|pop3)\d*\./, "");
	urls.push(`https://caldav.${mailDomain}`, `https://${mailDomain}`);
	const emailDomain = creds.username.split("@")[1];
	if (emailDomain && emailDomain !== mailDomain) {
		urls.push(`https://caldav.${emailDomain}`, `https://${emailDomain}`);
	}
	return urls.map((serverUrl) => ({ label: serverUrl, serverUrl }));
}

function toEvent(
	uid: string,
	start: ICAL.Time,
	end: ICAL.Time | null,
	summary: string | null,
	location: string | null,
): CalendarEvent {
	const isAllDay = start.isDate;
	const startIso = isAllDay
		? start.toString()
		: start.toJSDate().toISOString();
	const endIso = end
		? isAllDay
			? end.toString()
			: end.toJSDate().toISOString()
		: null;
	return {
		id: `${uid}:${startIso}`,
		summary,
		start: startIso,
		end: endIso,
		location,
		isAllDay,
	};
}

/** Expands one .ics payload into the events that fall inside the window. */
function eventsFromIcs(
	ics: string,
	rangeStart: Date,
	rangeEnd: Date,
): CalendarEvent[] {
	const component = new ICAL.Component(ICAL.parse(ics));
	const all = component
		.getAllSubcomponents("vevent")
		.map((v) => new ICAL.Event(v));

	const masters = all.filter((e) => !e.recurrenceId);
	const exceptions = all.filter((e) => e.recurrenceId);
	const mastersByUid = new Map(masters.map((m) => [m.uid, m]));
	const orphans: ICAL.Event[] = [];
	for (const exception of exceptions) {
		const master = mastersByUid.get(exception.uid);
		if (master) {
			master.relateException(exception);
		} else {
			orphans.push(exception);
		}
	}

	const inRange = (start: ICAL.Time, end: ICAL.Time | null) => {
		const s = start.toJSDate();
		const e = end ? end.toJSDate() : s;
		return s <= rangeEnd && e >= rangeStart;
	};

	const out: CalendarEvent[] = [];
	for (const event of [...masters, ...orphans]) {
		if (!event.startDate) {
			continue;
		}
		if (!event.isRecurring()) {
			if (inRange(event.startDate, event.endDate)) {
				out.push(
					toEvent(
						event.uid,
						event.startDate,
						event.endDate,
						event.summary || null,
						event.location || null,
					),
				);
			}
			continue;
		}
		const iterator = event.iterator();
		for (let i = 0; i < MAX_OCCURRENCES_PER_SERIES; i++) {
			const next = iterator.next();
			if (!next) {
				break;
			}
			const details = event.getOccurrenceDetails(next);
			if (details.startDate.toJSDate() > rangeEnd) {
				break;
			}
			if (inRange(details.startDate, details.endDate)) {
				out.push(
					toEvent(
						event.uid,
						details.startDate,
						details.endDate,
						details.item.summary || null,
						details.item.location || null,
					),
				);
			}
		}
	}
	return out;
}

/** Thrown when the server answers but refuses the login. */
class CalDavAuthError extends Error {}

const DISCOVERY_BODY =
	'<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:current-user-principal/><d:principal-URL/><c:calendar-home-set/><d:resourcetype/></d:prop></d:propfind>';

async function propfind(
	url: string,
	headers: Record<string, string>,
	depth: "0" | "1",
	body: string = DISCOVERY_BODY,
): Promise<{ status: number; text: string }> {
	const response = await fetch(url, {
		method: "PROPFIND",
		headers: {
			...headers,
			Depth: depth,
			"Content-Type": "application/xml",
		},
		body,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		redirect: "follow",
	});
	if (response.status === 401 || response.status === 403) {
		throw new CalDavAuthError(`HTTP ${response.status} from ${url}`);
	}
	return { status: response.status, text: await response.text() };
}

/** A short, single-line excerpt of a server reply, for error messages. */
function snippet(text: string): string {
	return text.replace(/\s+/g, " ").trim().slice(0, 160);
}

/** The first <href> inside the named DAV property, if the reply has one. */
function hrefInProp(xml: string, prop: string): string | null {
	const match = xml.match(
		new RegExp(`${prop}[^>]*>\\s*<[^>]*href[^>]*>\\s*([^<\\s]+)`, "i"),
	);
	return match ? match[1] : null;
}

/**
 * Cheap authenticated check that the calendar collection really answers as
 * CalDAV, so a wrong address is reported with the server's own reply instead
 * of tsdav's generic "expected a DAV multistatus response".
 */
async function probe(
	url: string,
	headers: Record<string, string>,
): Promise<void> {
	const { status, text } = await propfind(url, headers, "1");
	if (status !== 207) {
		throw new Error(`HTTP ${status} from ${url}: ${snippet(text)}`);
	}
}

/**
 * Zoho's calendar address contains an account id that isn't the email, and its
 * standard discovery redirects to a closed port. So ask the server: try the
 * likely entry points with the login and read the principal / calendar-home-set
 * out of whichever one answers.
 */
async function discoverZoho(
	root: string,
	username: string,
	headers: Record<string, string>,
): Promise<ExplicitUrls> {
	const who = encodeURIComponent(username);
	const entryPoints = [
		`${root}/caldav/`,
		`${root}/caldav/${who}/`,
		`${root}/caldav/${who}/user/`,
		`${root}/caldav/${who}/events/`,
	];
	const absolute = (href: string) => new URL(href, `${root}/`).toString();
	const tried: string[] = [];

	for (const url of entryPoints) {
		const { status, text } = await propfind(url, headers, "0");
		tried.push(`${status} ${url} ${snippet(text)}`);
		if (status !== 207) {
			continue;
		}
		let home = hrefInProp(text, "calendar-home-set");
		const principal =
			hrefInProp(text, "current-user-principal") ??
			hrefInProp(text, "principal-URL");
		if (!home && principal) {
			const second = await propfind(absolute(principal), headers, "0");
			tried.push(
				`${second.status} ${absolute(principal)} ${snippet(second.text)}`,
			);
			home = hrefInProp(second.text, "calendar-home-set");
		}
		if (home) {
			return {
				rootUrl: `${root}/`,
				principalUrl: absolute(principal ?? url),
				homeUrl: absolute(home),
			};
		}
	}
	throw new Error(
		`Zoho did not reveal the calendar address: ${tried.join(" | ")}`,
	);
}

// ── Hand-written CalDAV (used for Zoho) ────────────────────────────────────
// tsdav's calendar listing sends properties Zoho answers in a non-standard way
// ("expected a DAV multistatus response"), but Zoho serves plain PROPFIND /
// REPORT / PUT fine. These talk to it directly with only standard requests.

const RESPONSE_RE = /<(?:\w+:)?response[\s>][\s\S]*?<\/(?:\w+:)?response>/gi;

function responsesOf(xml: string): string[] {
	return xml.match(RESPONSE_RE) ?? [];
}

/** Inner text of the first <tag>…</tag>, whatever its namespace prefix. */
function firstTag(block: string, tag: string): string | null {
	const match = block.match(
		new RegExp(
			`<(?:\\w+:)?${tag}[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`,
			"i",
		),
	);
	return match ? match[1] : null;
}

function xmlDecode(value: string): string {
	return value
		.replace(/^\s*<!\[CDATA\[/, "")
		.replace(/\]\]>\s*$/, "")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
		.replace(/&amp;/g, "&");
}

const CALENDAR_LIST_BODY =
	'<?xml version="1.0"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:resourcetype/><d:displayname/><c:supported-calendar-component-set/></d:prop></d:propfind>';

/** URLs of the event calendars under a calendar-home collection. */
async function listCalendarUrlsManual(
	homeUrl: string,
	headers: Record<string, string>,
): Promise<string[]> {
	const { status, text } = await propfind(
		homeUrl,
		headers,
		"1",
		CALENDAR_LIST_BODY,
	);
	if (status !== 207) {
		throw new Error(
			`HTTP ${status} listing calendars at ${homeUrl}: ${snippet(text)}`,
		);
	}
	const urls: string[] = [];
	for (const block of responsesOf(text)) {
		const href = firstTag(block, "href");
		if (!href) {
			continue;
		}
		const resourceType = firstTag(block, "resourcetype") ?? "";
		if (!/<(?:\w+:)?calendar[\s/>]/i.test(resourceType)) {
			continue;
		}
		const components = block.match(/comp\s+name="[A-Z]+"/gi) ?? [];
		if (
			components.length > 0 &&
			!components.some((c) => /VEVENT/i.test(c))
		) {
			continue;
		}
		urls.push(new URL(href.trim(), homeUrl).toString());
	}
	// The home itself may be the (single) calendar collection.
	return urls.length > 0 ? urls : [homeUrl];
}

async function reportEventsManual(
	calendarUrl: string,
	headers: Record<string, string>,
	rangeStart: Date,
	rangeEnd: Date,
): Promise<string[]> {
	const body = `<?xml version="1.0"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="${icsUtc(rangeStart.toISOString())}" end="${icsUtc(rangeEnd.toISOString())}"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>`;
	const response = await fetch(calendarUrl, {
		method: "REPORT",
		headers: { ...headers, Depth: "1", "Content-Type": "application/xml" },
		body,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
		redirect: "follow",
	});
	const text = await response.text();
	if (response.status === 401 || response.status === 403) {
		throw new CalDavAuthError(
			`HTTP ${response.status} from ${calendarUrl}`,
		);
	}
	if (response.status !== 207) {
		throw new Error(
			`HTTP ${response.status} from REPORT ${calendarUrl}: ${snippet(text)}`,
		);
	}
	return responsesOf(text)
		.map((block) => firstTag(block, "calendar-data"))
		.filter((data): data is string => !!data)
		.map(xmlDecode);
}

async function fetchEventsManual(
	homeUrl: string,
	creds: ImapCredentials,
	rangeStart: Date,
	rangeEnd: Date,
): Promise<CalendarEvent[]> {
	const headers = getBasicAuthHeaders({
		username: creds.username,
		password: creds.password,
	});
	const events: CalendarEvent[] = [];
	for (const calendarUrl of await listCalendarUrlsManual(homeUrl, headers)) {
		for (const ics of await reportEventsManual(
			calendarUrl,
			headers,
			rangeStart,
			rangeEnd,
		)) {
			try {
				events.push(...eventsFromIcs(ics, rangeStart, rangeEnd));
			} catch {
				// One malformed event must not hide the rest of the calendar.
			}
		}
	}
	return events
		.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
		.slice(0, MAX_EVENTS);
}

async function createEventManual(
	homeUrl: string,
	creds: ImapCredentials,
	uid: string,
	iCalString: string,
): Promise<void> {
	const headers = getBasicAuthHeaders({
		username: creds.username,
		password: creds.password,
	});
	const [calendarUrl] = await listCalendarUrlsManual(homeUrl, headers);
	const base = calendarUrl.endsWith("/") ? calendarUrl : `${calendarUrl}/`;
	const response = await fetch(`${base}${uid}.ics`, {
		method: "PUT",
		headers: {
			...headers,
			"Content-Type": "text/calendar; charset=utf-8",
			"If-None-Match": "*",
		},
		body: iCalString,
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	if (response.status === 401 || response.status === 403) {
		throw new CalDavAuthError(`HTTP ${response.status} creating the event`);
	}
	if (!response.ok) {
		throw new Error(
			`HTTP ${response.status} creating the event: ${snippet(await response.text())}`,
		);
	}
}

/** Logs in via one candidate and returns the account's calendars. */
async function connectCalendars(candidate: Candidate, creds: ImapCredentials) {
	const fetchOptions = { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
	const credentials = { username: creds.username, password: creds.password };
	const headers = getBasicAuthHeaders(credentials);

	let explicit = candidate.explicit;
	if (candidate.resolve) {
		explicit = await candidate.resolve(headers);
	} else if (explicit) {
		await probe(explicit.homeUrl, headers);
	}

	const account = await createAccount({
		account: {
			accountType: "caldav",
			serverUrl: candidate.serverUrl,
			credentials,
			...explicit,
		},
		headers,
		fetchOptions,
	});
	const calendars = await fetchCalendars({ account, headers, fetchOptions });
	if (calendars.length === 0) {
		throw new Error("No calendars found for this account.");
	}
	return { headers, fetchOptions, calendars };
}

async function fetchEventsFrom(
	candidate: Candidate,
	creds: ImapCredentials,
	rangeStart: Date,
	rangeEnd: Date,
): Promise<CalendarEvent[]> {
	if (candidate.manualHomeUrl) {
		return fetchEventsManual(
			candidate.manualHomeUrl,
			creds,
			rangeStart,
			rangeEnd,
		);
	}
	const { headers, fetchOptions, calendars } = await connectCalendars(
		candidate,
		creds,
	);

	const events: CalendarEvent[] = [];
	for (const calendar of calendars) {
		// Skip task-only / non-event collections.
		if (
			calendar.components &&
			calendar.components.length > 0 &&
			!calendar.components.includes("VEVENT")
		) {
			continue;
		}
		const objects = await fetchCalendarObjects({
			calendar,
			headers,
			timeRange: {
				start: rangeStart.toISOString(),
				end: rangeEnd.toISOString(),
			},
			fetchOptions,
		});
		for (const object of objects) {
			if (typeof object.data !== "string" || !object.data) {
				continue;
			}
			try {
				events.push(
					...eventsFromIcs(object.data, rangeStart, rangeEnd),
				);
			} catch {
				// One malformed event must not hide the rest of the calendar.
			}
		}
	}
	return events
		.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""))
		.slice(0, MAX_EVENTS);
}

/** Events for a custom mailbox's own calendar, as a never-throwing result. */
export async function getCalDavEventsResult(
	accountId: string,
	opts: { timeMin?: string; timeMax?: string } = {},
): Promise<CalDavResult> {
	const now = new Date();
	const rangeStart = opts.timeMin ? new Date(opts.timeMin) : now;
	const rangeEnd = opts.timeMax
		? new Date(opts.timeMax)
		: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

	let creds: ImapCredentials;
	try {
		creds = await getImapCredentials(accountId);
	} catch (error) {
		return {
			status: "error",
			message: error instanceof Error ? error.message : String(error),
		};
	}

	const failures: string[] = [];
	let sawAuthError = false;
	for (const candidate of candidatesFor(creds)) {
		try {
			const events = await fetchEventsFrom(
				candidate,
				creds,
				rangeStart,
				rangeEnd,
			);
			return { status: "ok", events };
		} catch (error) {
			if (error instanceof CalDavAuthError) {
				sawAuthError = true;
			}
			failures.push(
				`${candidate.label}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	console.error("[caldav] could not load calendar:", failures);

	if (sawAuthError) {
		return {
			status: "error",
			message:
				"Your mail provider rejected the login for calendar access. Calendar sync needs an app-specific password if you use two-factor authentication — create one in your mail provider's security settings and reconnect the mailbox with it.",
		};
	}
	return {
		status: "error",
		message: `Couldn't reach your mail provider's calendar. ${failures.join(" | ")}`,
	};
}

function icsText(value: string): string {
	return value
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");
}

/** RFC 5545 line folding: content lines are limited to 75 octets. */
function foldIcsLine(line: string): string {
	const parts: string[] = [];
	let rest = line;
	while (Buffer.byteLength(rest) > 75) {
		let cut = 75;
		while (Buffer.byteLength(rest.slice(0, cut)) > 75) {
			cut--;
		}
		parts.push(rest.slice(0, cut));
		rest = ` ${rest.slice(cut)}`;
	}
	parts.push(rest);
	return parts.join("\r\n");
}

function icsUtc(iso: string): string {
	return new Date(iso)
		.toISOString()
		.replace(/[-:]/g, "")
		.replace(/\.\d{3}/, "");
}

export interface CalDavEventInput {
	summary: string;
	description?: string;
	attendees?: string[];
	organizerEmail: string;
	/** Timed event. */
	startIso?: string;
	endIso?: string;
	/** All-day event, YYYY-MM-DD (end exclusive). */
	allDayStart?: string;
	allDayEnd?: string;
}

/**
 * Creates an event in the mailbox's own calendar over CalDAV. Returns the
 * same shape as the Google path so callers don't care which one ran.
 */
export async function createCalDavEvent(
	accountId: string,
	input: CalDavEventInput,
): Promise<{
	eventId: string;
	htmlLink: string | null;
	start: string | null;
	end: string | null;
}> {
	const creds = await getImapCredentials(accountId);
	const uid = `${crypto.randomUUID()}@popsuites`;
	const allDay = !!input.allDayStart;
	const compact = (d: string) => d.replace(/-/g, "");

	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//Popsuites//Calendar//EN",
		"BEGIN:VEVENT",
		`UID:${uid}`,
		`DTSTAMP:${icsUtc(new Date().toISOString())}`,
		allDay
			? `DTSTART;VALUE=DATE:${compact(input.allDayStart as string)}`
			: `DTSTART:${icsUtc(input.startIso as string)}`,
		allDay
			? `DTEND;VALUE=DATE:${compact(input.allDayEnd as string)}`
			: `DTEND:${icsUtc(input.endIso as string)}`,
		`SUMMARY:${icsText(input.summary)}`,
	];
	if (input.description) {
		lines.push(`DESCRIPTION:${icsText(input.description)}`);
	}
	if (input.attendees && input.attendees.length > 0) {
		lines.push(`ORGANIZER:mailto:${input.organizerEmail}`);
		for (const attendee of input.attendees) {
			lines.push(
				`ATTENDEE;RSVP=TRUE;PARTSTAT=NEEDS-ACTION:mailto:${attendee}`,
			);
		}
	}
	lines.push("END:VEVENT", "END:VCALENDAR");
	const iCalString = `${lines.map(foldIcsLine).join("\r\n")}\r\n`;

	let lastError: unknown;
	for (const candidate of candidatesFor(creds)) {
		try {
			if (candidate.manualHomeUrl) {
				await createEventManual(
					candidate.manualHomeUrl,
					creds,
					uid,
					iCalString,
				);
				return {
					eventId: uid,
					htmlLink: null,
					start: allDay
						? (input.allDayStart as string)
						: (input.startIso as string),
					end: allDay
						? (input.allDayEnd as string)
						: (input.endIso as string),
				};
			}
			const { headers, fetchOptions, calendars } = await connectCalendars(
				candidate,
				creds,
			);
			const calendar =
				calendars.find(
					(c) =>
						!c.components ||
						c.components.length === 0 ||
						c.components.includes("VEVENT"),
				) ?? calendars[0];
			const response = await createCalendarObject({
				calendar,
				filename: `${uid}.ics`,
				iCalString,
				headers,
				fetchOptions,
			});
			if (!response.ok) {
				throw new Error(`HTTP ${response.status} creating the event`);
			}
			return {
				eventId: uid,
				htmlLink: null,
				start: allDay
					? (input.allDayStart as string)
					: (input.startIso as string),
				end: allDay
					? (input.allDayEnd as string)
					: (input.endIso as string),
			};
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError instanceof Error
		? lastError
		: new Error("Couldn't create the calendar event.");
}
