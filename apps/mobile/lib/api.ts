import { API_BASE } from "@/constants/config";
import { getToken } from "./auth";

async function apiFetch<T>(
	path: string,
	options: RequestInit = {},
): Promise<T> {
	const token = await getToken();
	const res = await fetch(`${API_BASE}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...(options.headers ?? {}),
		},
	});

	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`API ${res.status}: ${text.slice(0, 200)}`);
	}
	// Some POST actions return empty bodies.
	const text = await res.text();
	return (text ? JSON.parse(text) : null) as T;
}

export type Mailbox = {
	id: string;
	email: string;
	provider: "GOOGLE" | "OUTLOOK" | string;
};

export type InboxMessage = {
	id: string;
	from: string;
	subject: string;
	snippet: string;
	date: string;
	labelIds?: string[];
	isUnread?: boolean;
	inTrash?: boolean;
};

export type FullEmail = {
	id: string;
	from: string;
	fromEmail: string;
	subject: string;
	snippet: string;
	bodyText: string;
	bodyHtml: string;
	date: string;
};

export type CalendarEvent = {
	id: string;
	summary?: string;
	start?: string;
	end?: string;
	location?: string;
	isAllDay?: boolean;
};

export type Rule = {
	id: string;
	name: string;
	enabled: boolean;
	condition?: unknown;
	actions?: unknown;
};

export type CompiledRule = {
	name: string;
	condition: unknown;
	actions: { type: string; label?: string; to?: string }[];
};

export type RuleSuggestion = {
	id?: string;
	name?: string;
	title?: string;
	description?: string;
	reason?: string;
};

export type ExecutionLog = {
	id: string;
	status: string;
	subject?: string | null;
	from?: string | null;
	createdAt: string;
	ruleId?: string;
};

export type MailboxStats = {
	processedToday: number;
	processed7d: number;
	firedToday: number;
	fired7d: number;
	errorsToday: number;
	rulesActive: number;
	rulesTotal: number;
	topRules7d?: Array<{ id: string; name: string; count: number }>;
	sparkline7d?: Array<{ day: string; processed: number; fired: number }>;
};

export type EmailAi = {
	emailId: string;
	aiPriority: string | null;
	aiSummary: string | null;
	aiCategory: string | null;
	labels: { name: string; color: string; icon: string | null }[];
};

export type TaskItem = {
	emailId: string;
	taskType: "PAYMENT" | "ACTION" | string;
	taskTitle: string | null;
	taskDue: string | null;
	payAmount: string | null;
	payMerchant: string | null;
	aiSummary: string | null;
};

// Analytics is user-scoped (aggregated across every mailbox), unlike the
// mailbox-scoped stats above.
export type AnalyticsOverview = {
	totalEmailsProcessed: number;
	automationSuccessRate: {
		rate: number;
		matched: number;
		errors: number;
		total: number;
	};
	activeRules: { active: number; total: number };
};

export type VolumePoint = {
	date: string;
	total: number;
	matched: number;
	errors: number;
};

export type TopSender = { sender: string; count: number };

export const api = {
	getMailboxes: () => apiFetch<Mailbox[]>("/users/connected-mailboxes"),

	// Pull newest mail from Gmail/Outlook into the DB, then the caller refetches.
	syncRecent: (mailboxId: string) =>
		apiFetch(`/mailboxes/${mailboxId}/inbox/sync`, {
			method: "POST",
			body: JSON.stringify({ mode: "recent" }),
		}),

	getInbox: (mailboxId: string, folder = "inbox", search?: string) =>
		apiFetch<{ messages: InboxMessage[]; nextPageToken?: string }>(
			`/mailboxes/${mailboxId}/inbox?folder=${folder}&maxResults=50${
				search ? `&search=${encodeURIComponent(search)}` : ""
			}`,
		),

	getMessage: (mailboxId: string, messageId: string) =>
		apiFetch<FullEmail>(`/mailboxes/${mailboxId}/inbox/${messageId}`),

	archive: (mailboxId: string, messageId: string) =>
		apiFetch(`/mailboxes/${mailboxId}/inbox/${messageId}/archive`, {
			method: "POST",
			body: "{}",
		}),

	markRead: (mailboxId: string, messageId: string) =>
		apiFetch(`/mailboxes/${mailboxId}/inbox/${messageId}/mark-read`, {
			method: "POST",
			body: "{}",
		}),

	markUnread: (mailboxId: string, messageId: string) =>
		apiFetch(`/mailboxes/${mailboxId}/inbox/${messageId}/mark-unread`, {
			method: "POST",
			body: "{}",
		}),

	trash: (mailboxId: string, messageId: string) =>
		apiFetch(`/mailboxes/${mailboxId}/inbox/${messageId}/trash`, {
			method: "POST",
			body: "{}",
		}),

	snooze: (mailboxId: string, messageId: string, snoozeUntil: string) =>
		apiFetch(`/mailboxes/${mailboxId}/inbox/${messageId}/snooze`, {
			method: "POST",
			body: JSON.stringify({ snoozeUntil }),
		}),

	getStats: (mailboxId: string) =>
		apiFetch<MailboxStats>(`/mailboxes/${mailboxId}/stats`),

	getRules: (mailboxId: string) =>
		apiFetch<{ rules: Rule[] }>(`/mailboxes/${mailboxId}/rules`),

	getRuleSuggestions: (mailboxId: string) =>
		apiFetch<{ suggestions?: RuleSuggestion[] } | RuleSuggestion[]>(
			`/mailboxes/${mailboxId}/rules/suggestions`,
		),

	toggleRule: (mailboxId: string, id: string, enabled: boolean) =>
		apiFetch(`/mailboxes/${mailboxId}/rules/${id}/toggle`, {
			method: "PUT",
			body: JSON.stringify({ enabled }),
		}),

	// Natural language → structured rule(s) via Gemini.
	compileRule: (mailboxId: string, prompt: string) =>
		apiFetch<{ rules: CompiledRule[] }>(
			`/mailboxes/${mailboxId}/rules/compile`,
			{ method: "POST", body: JSON.stringify({ prompt }) },
		),

	createRule: (
		mailboxId: string,
		data: CompiledRule & { enabled: boolean },
	) =>
		apiFetch(`/mailboxes/${mailboxId}/rules`, {
			method: "POST",
			body: JSON.stringify({ data }),
		}),

	getExecutionLogs: (mailboxId: string) =>
		apiFetch<{ logs?: ExecutionLog[] } | ExecutionLog[]>(
			`/mailboxes/${mailboxId}/execution-logs`,
		),

	send: (
		mailboxId: string,
		data: { to: string; subject: string; body: string },
	) =>
		apiFetch(`/mailboxes/${mailboxId}/send`, {
			method: "POST",
			body: JSON.stringify(data),
		}),

	// `range` scopes the fetch to the visible month grid. Omit it for the
	// plain "upcoming events" behaviour.
	calendar: (
		mailboxId: string,
		range?: { timeMin: string; timeMax: string },
	) =>
		apiFetch<
			| CalendarEvent[]
			| {
					events: CalendarEvent[];
					needsReconnect?: boolean;
					serviceDisabled?: boolean;
			  }
		>(
			`/mailboxes/${mailboxId}/calendar/events${
				range
					? `?timeMin=${encodeURIComponent(
							range.timeMin,
						)}&timeMax=${encodeURIComponent(range.timeMax)}`
					: ""
			}`,
		),

	getAnalyticsOverview: () =>
		apiFetch<AnalyticsOverview>("/analytics/overview"),

	getTopSenders: (limit = 10) =>
		apiFetch<{ senders: TopSender[] }>(
			`/analytics/top-senders?limit=${limit}`,
		),

	getEmailVolume: (days = 30) =>
		apiFetch<{ volume: VolumePoint[] }>(
			`/analytics/email-volume?days=${days}`,
		),

	// AI enrichment (labels + priority + summary) for a mailbox's emails.
	getMailboxAi: (mailboxId: string) =>
		apiFetch<{ items: EmailAi[] }>(`/mailboxes/${mailboxId}/ai`),

	// Extracted payments + action items.
	getMailboxTasks: (mailboxId: string) =>
		apiFetch<{ items: TaskItem[] }>(`/mailboxes/${mailboxId}/tasks`),

	// MonkeyChan — RAG chat with your mailbox (server threads).
	mailChat: (
		mailboxId: string,
		body: { question: string; threadId?: string; mentions?: string[] },
	) =>
		apiFetch<{
			threadId: string;
			answer: string;
			sources: { email_id: string; from: string; subject: string }[];
		}>(`/mailboxes/${mailboxId}/chat`, {
			method: "POST",
			body: JSON.stringify(body),
		}),

	listChatThreads: (mailboxId: string) =>
		apiFetch<{
			threads: { id: string; title: string; updatedAt: string }[];
		}>(`/mailboxes/${mailboxId}/chat/threads`),

	getChatThread: (mailboxId: string, threadId: string) =>
		apiFetch<{
			messages: { role: string; content: string; sources: unknown }[];
		}>(`/mailboxes/${mailboxId}/chat/threads/${threadId}`),

	// Current signed-in user (name/email/avatar) via Better Auth.
	getSession: () =>
		apiFetch<{
			user?: { name?: string; email?: string; image?: string };
		} | null>("/auth/get-session"),
};

// Parse "Name <email@x.com>" → { name, email }
export function parseSender(from: string): { name: string; email: string } {
	const match = from.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>/);
	if (match) {
		const name = match[1].trim();
		const email = match[2].trim().toLowerCase();
		return { name: name || email, email };
	}
	const email = from.trim().toLowerCase();
	return { name: from.trim() || email, email };
}
