import { ORPCError } from "@orpc/server";
import { logger } from "@repo/logs";
import { getMicrosoftAccessToken } from "./microsoft-auth";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

async function graphRequest<T>(
	accountId: string,
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const token = await getMicrosoftAccessToken(accountId);
	const res = await fetch(`${GRAPH_BASE}${path}`, {
		...options,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			...options.headers,
		},
	});

	if (!res.ok) {
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
}

export async function getOutlookMessage(
	accountId: string,
	messageId: string,
): Promise<GraphMessage> {
	return graphRequest<GraphMessage>(
		accountId,
		`/me/messages/${messageId}?$select=id,conversationId,subject,bodyPreview,receivedDateTime,isRead,from,toRecipients,body,internetMessageHeaders,categories`,
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
		replyTo?: string;
	},
) {
	const message: Record<string, unknown> = {
		subject: payload.subject,
		body: { contentType: "Text", content: payload.body },
		toRecipients: [makeRecipient(payload.to)],
	};
	if (payload.cc) {
		message.ccRecipients = payload.cc
			.split(",")
			.map((a) => makeRecipient(a.trim()));
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
