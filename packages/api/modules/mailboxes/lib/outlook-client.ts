import { ORPCError } from "@orpc/server";
import { logger } from "@repo/logs";
import {
	integrationApiCalls,
	integrationRateLimitRemaining,
} from "@repo/metrics";
import { getMicrosoftAccessToken } from "./microsoft-auth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Graph paths interpolate resource IDs (message/category/subscription IDs).
// Collapse anything that isn't a known static route segment to ":id" so the
// `endpoint` label stays a fixed, low-cardinality set instead of growing one
// series per message ever touched.
const GRAPH_PATH_STATIC_SEGMENTS = new Set([
	"",
	"me",
	"messages",
	"mailFolders",
	"inbox",
	"move",
	"sendMail",
	"reply",
	"forward",
	"outlook",
	"masterCategories",
	"subscriptions",
	"events",
]);

function normalizeGraphPath(path: string): string {
	return path
		.split("?")[0]
		.split("/")
		.map((segment) =>
			GRAPH_PATH_STATIC_SEGMENTS.has(segment) ? segment : ":id",
		)
		.join("/");
}

async function graphRequest<T>(
	accountId: string,
	path: string,
	options: RequestInit = {},
	retriesLeft = 3,
): Promise<T> {
	const token = await getMicrosoftAccessToken(accountId);
	const endpoint = normalizeGraphPath(path);
	const res = await fetch(`${GRAPH_BASE}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	if (!res.ok) {
		integrationApiCalls.inc({
			provider: "outlook",
			endpoint,
			status_code: String(res.status),
		});

		if (res.status === 429 && retriesLeft > 0) {
			// Graph doesn't expose a numeric quota remaining — treat "currently
			// throttled" as 0 so it lands on the same rate-limit-proximity panel
			// as providers that do send a real quota count.
			integrationRateLimitRemaining.set({ provider: "outlook" }, 0);
			const retryAfterHeader = res.headers.get("Retry-After");
			const retryAfterMs = retryAfterHeader
				? Number(retryAfterHeader) * 1000
				: 1000;
			logger.warn("[outlook-client] Rate limited, retrying", {
				accountId,
				path,
				retryAfterMs,
				retriesLeft,
			});
			await sleep(retryAfterMs);
			return graphRequest<T>(accountId, path, options, retriesLeft - 1);
		}

		const errorBody = (await res.json().catch(() => ({}))) as {
			error?: { code?: string; message?: string };
		};
		const code = errorBody.error?.code;
		const message = errorBody.error?.message ?? `Graph ${res.status}`;

		logger.error("[outlook-client] Graph API error", {
			accountId,
			path,
			status: res.status,
			code,
			message,
		});

		if (res.status === 401 || code === "InvalidAuthenticationToken") {
			throw new ORPCError("UNAUTHORIZED", {
				message:
					"Outlook authorization is no longer valid — please reconnect your mailbox.",
			});
		}
		throw new Error(`Graph API error ${res.status}: ${message}`);
	}

	integrationApiCalls.inc({
		provider: "outlook",
		endpoint,
		status_code: String(res.status),
	});
	integrationRateLimitRemaining.set({ provider: "outlook" }, 1);

	if (res.status === 204) {
		return undefined as unknown as T;
	}
	return res.json() as Promise<T>;
}

// --- User Profile ---

export async function getOutlookUserProfile(accountId: string) {
	return graphRequest<{
		mail?: string;
		userPrincipalName?: string;
		displayName?: string;
	}>(accountId, "/me");
}

// --- Message Operations ---

export interface GraphMessage {
	id: string;
	conversationId: string;
	subject?: string;
	bodyPreview?: string;
	receivedDateTime: string;
	isRead: boolean;
	from?: { emailAddress?: { name?: string; address?: string } };
	toRecipients?: Array<{
		emailAddress?: { name?: string; address?: string };
	}>;
	body?: { contentType?: string; content?: string };
	internetMessageHeaders?: Array<{ name: string; value: string }>;
	categories?: string[];
	importance?: "low" | "normal" | "high";
	hasAttachments?: boolean;
}

export async function getOutlookMessage(
	accountId: string,
	messageId: string,
): Promise<GraphMessage> {
	return graphRequest<GraphMessage>(
		accountId,
		`/me/messages/${messageId}?$select=id,conversationId,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,body,internetMessageHeaders,categories,importance,hasAttachments`,
	);
}

export interface GraphAttachment {
	id: string;
	name: string;
	contentType: string;
	size: number;
	// fileAttachment-only field — inline/item attachments are filtered out by
	// listOutlookAttachments below, so callers only ever see this present.
	contentBytes?: string;
}

/** Lists file attachments on a message (metadata only — contentBytes omitted for size). */
export async function listOutlookAttachments(
	accountId: string,
	messageId: string,
): Promise<GraphAttachment[]> {
	const res = await graphRequest<{ value: GraphAttachment[] }>(
		accountId,
		`/me/messages/${messageId}/attachments?$select=id,name,contentType,size`,
	);
	return res.value;
}

/** Fetches one attachment's content (base64-encoded in contentBytes) by its id. */
export async function getOutlookAttachment(
	accountId: string,
	messageId: string,
	attachmentId: string,
): Promise<GraphAttachment> {
	return graphRequest<GraphAttachment>(
		accountId,
		`/me/messages/${messageId}/attachments/${attachmentId}`,
	);
}

export async function listOutlookInboxMessages(
	accountId: string,
	opts: {
		maxResults?: number;
		skipToken?: string;
		windowStart?: Date;
		windowEnd?: Date;
	} = {},
) {
	const params = new URLSearchParams();
	params.set("$select", "id,subject,receivedDateTime");
	params.set("$top", String(opts.maxResults ?? 25));
	// $orderby is incompatible with $skipToken in Graph OData server-side paging
	if (!opts.skipToken) {
		params.set("$orderby", "receivedDateTime desc");
	}

	const filters: string[] = [];
	if (opts.windowStart) {
		filters.push(`receivedDateTime ge ${opts.windowStart.toISOString()}`);
	}
	if (opts.windowEnd) {
		filters.push(`receivedDateTime le ${opts.windowEnd.toISOString()}`);
	}
	if (filters.length > 0) {
		params.set("$filter", filters.join(" and "));
	}
	if (opts.skipToken) {
		params.set("$skipToken", opts.skipToken);
	}

	const path = `/me/mailFolders/inbox/messages?${params}`;

	return graphRequest<{
		value: Array<{ id: string }>;
		"@odata.nextLink"?: string;
	}>(accountId, path);
}

export async function updateOutlookMessage(
	accountId: string,
	messageId: string,
	data: {
		isRead?: boolean;
		categories?: string[];
	},
) {
	return graphRequest<GraphMessage>(accountId, `/me/messages/${messageId}`, {
		method: "PATCH",
		body: JSON.stringify(data),
	});
}

export async function moveOutlookMessage(
	accountId: string,
	messageId: string,
	destinationId: string,
) {
	return graphRequest<GraphMessage>(
		accountId,
		`/me/messages/${messageId}/move`,
		{
			method: "POST",
			body: JSON.stringify({ destinationId }),
		},
	);
}

// --- Send / Draft Operations ---

interface OutlookRecipient {
	emailAddress: { address: string; name?: string };
}

function makeRecipient(address: string): OutlookRecipient {
	return { emailAddress: { address } };
}

export async function sendOutlookMessage(
	accountId: string,
	payload: {
		to: string;
		subject: string;
		body: string;
		cc?: string;
		bcc?: string;
		isHtml?: boolean;
		replyTo?: string;
	},
) {
	const splitRecipients = (list: string) =>
		list
			.split(",")
			.map((a) => a.trim())
			.filter(Boolean)
			.map(makeRecipient);
	const message: Record<string, unknown> = {
		subject: payload.subject,
		body: {
			contentType: payload.isHtml ? "HTML" : "Text",
			content: payload.body,
		},
		toRecipients: splitRecipients(payload.to),
	};
	if (payload.cc) {
		message.ccRecipients = splitRecipients(payload.cc);
	}
	if (payload.bcc) {
		message.bccRecipients = splitRecipients(payload.bcc);
	}

	return graphRequest<void>(accountId, "/me/sendMail", {
		method: "POST",
		body: JSON.stringify({ message, saveToSentItems: true }),
	});
}

export async function replyToOutlookMessage(
	accountId: string,
	messageId: string,
	comment: string,
) {
	return graphRequest<void>(accountId, `/me/messages/${messageId}/reply`, {
		method: "POST",
		body: JSON.stringify({ comment }),
	});
}

export async function forwardOutlookMessage(
	accountId: string,
	messageId: string,
	toAddress: string,
	comment: string,
) {
	return graphRequest<void>(accountId, `/me/messages/${messageId}/forward`, {
		method: "POST",
		body: JSON.stringify({
			toRecipients: [makeRecipient(toAddress)],
			comment,
		}),
	});
}

export async function createOutlookDraft(
	accountId: string,
	payload: {
		to: string;
		subject: string;
		body: string;
	},
) {
	return graphRequest<GraphMessage>(accountId, "/me/messages", {
		method: "POST",
		body: JSON.stringify({
			subject: payload.subject,
			body: { contentType: "Text", content: payload.body },
			toRecipients: [makeRecipient(payload.to)],
		}),
	});
}

// --- Category (Label) Operations ---

export async function listOutlookCategories(accountId: string) {
	const data = await graphRequest<{
		value: Array<{ id: string; displayName: string }>;
	}>(accountId, "/me/outlook/masterCategories");
	return data.value;
}

export async function createOutlookCategory(
	accountId: string,
	displayName: string,
) {
	// Pick a preset color cycling through Graph's allowed colors
	const COLORS = [
		"preset0",
		"preset1",
		"preset2",
		"preset3",
		"preset4",
		"preset5",
	];
	const colorIndex = Math.abs(
		displayName.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) %
			COLORS.length,
	);
	return graphRequest<{ id: string; displayName: string }>(
		accountId,
		"/me/outlook/masterCategories",
		{
			method: "POST",
			body: JSON.stringify({
				displayName,
				color: COLORS[colorIndex],
			}),
		},
	);
}

export async function deleteOutlookCategory(
	accountId: string,
	categoryId: string,
) {
	await graphRequest(
		accountId,
		`/me/outlook/masterCategories/${categoryId}`,
		{ method: "DELETE" },
	);
}

// --- Change Notification Subscriptions ---

export async function createOutlookSubscription(
	accountId: string,
	webhookUrl: string,
	clientState: string,
) {
	const expirationDateTime = new Date(
		Date.now() + 4230 * 60 * 1000,
	).toISOString();

	return graphRequest<{
		id: string;
		expirationDateTime: string;
		clientState: string;
	}>(accountId, "/subscriptions", {
		method: "POST",
		body: JSON.stringify({
			changeType: "created",
			notificationUrl: webhookUrl,
			resource: "me/mailFolders('inbox')/messages",
			expirationDateTime,
			clientState,
		}),
	});
}

export async function renewOutlookSubscription(
	accountId: string,
	subscriptionId: string,
) {
	const expirationDateTime = new Date(
		Date.now() + 4230 * 60 * 1000,
	).toISOString();

	return graphRequest<{ id: string; expirationDateTime: string }>(
		accountId,
		`/subscriptions/${subscriptionId}`,
		{
			method: "PATCH",
			body: JSON.stringify({ expirationDateTime }),
		},
	);
}

export async function deleteOutlookSubscription(
	accountId: string,
	subscriptionId: string,
) {
	return graphRequest<void>(accountId, `/subscriptions/${subscriptionId}`, {
		method: "DELETE",
	});
}

// --- Teams Meetings ---

export interface OutlookCreatedMeeting {
	eventId: string;
	meetLink: string;
	htmlLink: string | null;
	start: string | null;
	end: string | null;
}

/** Graph wants a plain local/UTC dateTime (no trailing Z) plus a timeZone. */
function toGraphDateTime(iso: string): string {
	return new Date(iso).toISOString().slice(0, 19);
}

/**
 * Creates an Outlook calendar event with a Microsoft Teams online meeting
 * attached and returns the join link — the Teams analog of createGoogleMeet.
 *
 * Requires the Azure app registration to have the Calendars.ReadWrite Graph
 * permission (with consent); Graph responds 403 ErrorAccessDenied otherwise,
 * which classifyTeamsMeetingError surfaces as `needsReconnect`. Teams links
 * are only issued for work/school (Microsoft 365) accounts — personal
 * outlook.com accounts return no joinUrl.
 */
export async function createOutlookMeeting(
	accountId: string,
	opts: {
		summary: string;
		startIso: string;
		endIso: string;
		attendees?: string[];
		description?: string;
	},
): Promise<OutlookCreatedMeeting> {
	const event = await graphRequest<{
		id?: string;
		webLink?: string;
		start?: { dateTime?: string };
		end?: { dateTime?: string };
		onlineMeeting?: { joinUrl?: string };
	}>(accountId, "/me/events", {
		method: "POST",
		body: JSON.stringify({
			subject: opts.summary,
			...(opts.description
				? { body: { contentType: "text", content: opts.description } }
				: {}),
			start: {
				dateTime: toGraphDateTime(opts.startIso),
				timeZone: "UTC",
			},
			end: { dateTime: toGraphDateTime(opts.endIso), timeZone: "UTC" },
			...(opts.attendees?.length
				? {
						attendees: opts.attendees.map((address) => ({
							emailAddress: { address },
							type: "required",
						})),
					}
				: {}),
			isOnlineMeeting: true,
			onlineMeetingProvider: "teamsForBusiness",
		}),
	});

	const meetLink = event.onlineMeeting?.joinUrl;
	if (!meetLink) {
		throw new Error(
			"Microsoft did not return a Teams join link — personal accounts don't support Teams meetings.",
		);
	}

	return {
		eventId: event.id ?? "",
		meetLink,
		htmlLink: event.webLink ?? null,
		start: event.start?.dateTime ?? null,
		end: event.end?.dateTime ?? null,
	};
}

/**
 * Maps createOutlookMeeting failures to the same classified statuses the
 * calendar/zoom clients use, so the create-meeting procedure treats all
 * providers uniformly.
 */
export function classifyTeamsMeetingError(
	error: unknown,
): { status: "needsReconnect" } | { status: "error"; message: string } {
	if (error instanceof ORPCError && error.code === "UNAUTHORIZED") {
		return { status: "needsReconnect" };
	}
	const message = error instanceof Error ? error.message : String(error);
	// 403 = the Calendars.ReadWrite permission is missing on the Azure app (or
	// consent wasn't granted) — reconnect/consent is the fix either way.
	if (message.includes("403") || message.includes("ErrorAccessDenied")) {
		return { status: "needsReconnect" };
	}
	return { status: "error", message };
}
