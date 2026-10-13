import { randomInt } from "node:crypto";
import { generateWithSarvam } from "@repo/ai";
import {
	claimTelegramAction,
	consumeTelegramLinkToken,
	createTelegramAction,
	createTelegramLinkToken,
	db,
	getTelegramConnectionByChatId,
	getTelegramConnectionByUserId,
	listEnabledTelegramConnections,
	recordTelegramBriefing,
	updateEmailLabels,
	updateMailboxSyncState,
	updateTelegramConnection,
	upsertTelegramConnection,
} from "@repo/database";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { getBaseUrl } from "@repo/utils";
import { z } from "zod";
import { listUpcomingEvents } from "../mailboxes/lib/calendar-client";
import { syncAllEmails } from "../mailboxes/lib/email-sync";
import {
	modifyMessageLabels,
	trashMessage as trashGmailMessage,
} from "../mailboxes/lib/gmail-client";
import {
	moveOutlookMessage,
	updateOutlookMessage,
} from "../mailboxes/lib/outlook-client";
import {
	answerTelegramCallbackQuery,
	editTelegramMessageReplyMarkup,
	type InlineKeyboardMarkup,
	sendTelegramMessage,
} from "./client";

type TelegramUser = {
	id: number;
	is_bot?: boolean;
	first_name?: string;
	last_name?: string;
	username?: string;
	language_code?: string;
};

type TelegramChat = {
	id: number;
	type: "private" | "group" | "supergroup" | "channel" | string;
};

type TelegramMessage = {
	message_id: number;
	from?: TelegramUser;
	chat: TelegramChat;
	text?: string;
};

type TelegramCallbackQuery = {
	id: string;
	from: TelegramUser;
	message?: TelegramMessage;
	data?: string;
};

export type TelegramUpdate = {
	update_id: number;
	message?: TelegramMessage;
	callback_query?: TelegramCallbackQuery;
};

type MailboxForDigest = {
	id: string;
	accountId: string;
	email: string;
	provider: "GOOGLE" | "OUTLOOK";
};

type DigestEmail = {
	id: string;
	threadId: string;
	mailboxId: string;
	from: string;
	fromEmail: string;
	subject: string;
	snippet: string;
	bodyText: string;
	internalDate: Date;
};

type DecisionCategory = "HANDLE_NOW" | "CHECK_TODAY" | "FYI";

type ClassifiedEmail = DigestEmail & {
	category: DecisionCategory;
	reason: string;
};

const ACTION_CALLBACK_PREFIX = "act:";
const LINK_PREFIX = "link_";
const DEFAULT_TIME_ZONE = "Asia/Calcutta";
const DEFAULT_DIGEST_TIME = "09:00";

const LOGIN_STATE_PREFIX = "telegram:login:";
const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;

type LoginState =
	| { step: "email" }
	| { step: "otp"; email: string; otp: string; attempts: number };

// ── Conversation context ──────────────────────────────────────────────────────

const CTX_PREFIX = "telegram:ctx:";
const CTX_TTL_MS = 30 * 60 * 1000;

type EmailRef = {
	id: string;
	mailboxId: string;
	subject: string;
	from: string;
};
type RuleRef = {
	id: string;
	mailboxId: string;
	name: string;
	enabled: boolean;
};

type ConvCtx = {
	lastEmailId?: string;
	lastEmailMailboxId?: string;
	lastEmailList?: EmailRef[];
	lastRuleList?: RuleRef[];
	pendingAction?: {
		type: "send" | "reply" | "forward" | "delete_rule" | "create_rule";
		data: Record<string, unknown>;
	};
};

async function getConvCtx(chatId: string): Promise<ConvCtx> {
	const record = await db.verification.findFirst({
		where: {
			identifier: `${CTX_PREFIX}${chatId}`,
			expiresAt: { gt: new Date() },
		},
	});
	if (!record) {
		return {};
	}
	try {
		return JSON.parse(record.value) as ConvCtx;
	} catch {
		return {};
	}
}

async function setConvCtx(chatId: string, ctx: ConvCtx): Promise<void> {
	const identifier = `${CTX_PREFIX}${chatId}`;
	const expiresAt = new Date(Date.now() + CTX_TTL_MS);
	const now = new Date();
	await db.verification.deleteMany({ where: { identifier } });
	await db.verification.create({
		data: {
			identifier,
			value: JSON.stringify(ctx),
			expiresAt,
			createdAt: now,
			updatedAt: now,
		},
	});
}

// ── Intent schema ─────────────────────────────────────────────────────────────

const INTENT_SCHEMA = z.object({
	intent: z.enum([
		"INBOX_LIST",
		"EMAIL_READ",
		"EMAIL_ACTION",
		"EMAIL_SEND",
		"EMAIL_REPLY",
		"EMAIL_FORWARD",
		"RULE_LIST",
		"RULE_CREATE",
		"RULE_TOGGLE",
		"RULE_DELETE",
		"RULE_SUGGESTIONS",
		"CALENDAR_LIST",
		"STATS",
		"ACTIVITY",
		"MAILBOX_LIST",
		"SETTINGS_VIEW",
		"SETTINGS_UPDATE",
		"SYNC",
		"BRIEF",
		"DAY",
		"WHATNEXT",
		"CONFIRM_YES",
		"CONFIRM_NO",
		"HELP",
		"UNKNOWN",
	]),
	params: z.object({
		folder: z.string().optional(),
		emailIndex: z.number().optional(),
		emailSearch: z.string().optional(),
		action: z.string().optional(),
		to: z.string().optional(),
		subject: z.string().optional(),
		body: z.string().optional(),
		ruleIndex: z.number().optional(),
		ruleName: z.string().optional(),
		rulePrompt: z.string().optional(),
		enabled: z.boolean().optional(),
		dateExpr: z.string().optional(),
		digestTime: z.string().optional(),
		timezone: z.string().optional(),
	}),
});

type ParsedIntent = z.infer<typeof INTENT_SCHEMA>;

async function classifyIntent(
	text: string,
	ctx: ConvCtx,
): Promise<ParsedIntent> {
	if (!process.env.SARVAM_API_KEY) {
		return { intent: "UNKNOWN", params: {} };
	}
	try {
		const ctxHint = [
			ctx.lastEmailList?.length
				? `Last email list: ${ctx.lastEmailList.map((e, i) => `${i + 1}. "${e.subject}" from ${e.from}`).join(", ")}`
				: "",
			ctx.lastEmailId ? `Last opened email id: ${ctx.lastEmailId}` : "",
			ctx.lastRuleList?.length
				? `Last rule list: ${ctx.lastRuleList.map((r, i) => `${i + 1}. "${r.name}" (${r.enabled ? "on" : "off"})`).join(", ")}`
				: "",
			ctx.pendingAction
				? `Pending action: ${ctx.pendingAction.type}`
				: "",
		]
			.filter(Boolean)
			.join("\n");

		const object = await generateWithSarvam({
			schema: INTENT_SCHEMA,
			temperature: 0,
			system: `You are a Telegram bot assistant for Zeromail, an email automation app.
Classify the user message into one intent and extract parameters.

INTENTS:
- INBOX_LIST: show emails in a folder. params: folder (inbox/sent/trash/spam/all, default inbox)
- EMAIL_READ: open/read a specific email. params: emailIndex (1-based), emailSearch (text to find)
- EMAIL_ACTION: act on an email. params: action (archive/trash/markRead/markUnread), emailIndex (optional, uses last if absent)
- EMAIL_SEND: compose new email. params: to, subject, body
- EMAIL_REPLY: reply to current email. params: body, to (optional override)
- EMAIL_FORWARD: forward current email. params: to
- RULE_LIST: list all rules
- RULE_CREATE: create new rule from natural language. params: rulePrompt (the full rule description)
- RULE_TOGGLE: enable or disable a rule. params: ruleIndex, ruleName, enabled (true=enable, false=disable)
- RULE_DELETE: delete a rule. params: ruleIndex, ruleName
- RULE_SUGGESTIONS: get AI rule suggestions
- CALENDAR_LIST: show calendar events. params: dateExpr (today/tomorrow/monday/this week/next week, default today)
- STATS: show email processing stats
- ACTIVITY: show recent rule activity/execution log
- MAILBOX_LIST: show connected mailboxes
- SETTINGS_VIEW: show current settings
- SETTINGS_UPDATE: change a setting. params: digestTime (HH:MM), timezone (IANA name)
- SYNC: sync/fetch latest emails from Gmail
- BRIEF: inbox briefing (AI classified summary)
- DAY: today's email summary
- WHATNEXT: upcoming calendar events (next 24h)
- CONFIRM_YES: user confirming a pending action (yes/ok/confirm/send/do it/sure)
- CONFIRM_NO: user cancelling a pending action (no/cancel/stop/nevermind)
- HELP: user asking for help
- UNKNOWN: cannot determine intent

${ctxHint ? `CONVERSATION CONTEXT:\n${ctxHint}` : ""}

Examples:
"show my inbox" → INBOX_LIST, folder=inbox
"check sent" → INBOX_LIST, folder=sent
"open email 3" → EMAIL_READ, emailIndex=3
"read the one from Google" → EMAIL_READ, emailSearch="Google"
"archive it" → EMAIL_ACTION, action=archive
"trash email 2" → EMAIL_ACTION, action=trash, emailIndex=2
"mark as read" → EMAIL_ACTION, action=markRead
"send email to john@example.com about meeting" → EMAIL_SEND, to=john@example.com, subject=meeting
"reply saying I'll be there" → EMAIL_REPLY, body=I'll be there
"forward to boss@company.com" → EMAIL_FORWARD, to=boss@company.com
"show my rules" → RULE_LIST
"create a rule to archive newsletters" → RULE_CREATE, rulePrompt=archive newsletters
"disable rule 2" → RULE_TOGGLE, ruleIndex=2, enabled=false
"enable the newsletter rule" → RULE_TOGGLE, ruleName=newsletter, enabled=true
"delete rule 1" → RULE_DELETE, ruleIndex=1
"any rule suggestions?" → RULE_SUGGESTIONS
"what's on my calendar tomorrow?" → CALENDAR_LIST, dateExpr=tomorrow
"show Monday's schedule" → CALENDAR_LIST, dateExpr=monday
"show my stats" → STATS
"recent activity" → ACTIVITY
"what mailboxes are connected?" → MAILBOX_LIST
"show settings" → SETTINGS_VIEW
"change digest time to 8am" → SETTINGS_UPDATE, digestTime=08:00
"set timezone to IST" → SETTINGS_UPDATE, timezone=Asia/Calcutta
"sync my emails" → SYNC
"give me a briefing" → BRIEF
"what happened today?" → DAY
"what's next?" → WHATNEXT
"yes" → CONFIRM_YES
"cancel" → CONFIRM_NO

OUTPUT FORMAT: respond with a single JSON object {"intent": "<ONE_OF_THE_INTENTS_ABOVE>", "params": {...only the relevant params for that intent...}}. Omit params keys that don't apply — never include a key with an empty/placeholder value.`,
			prompt: text,
		});
		return object;
	} catch (error) {
		logger.error("[telegram] classifyIntent failed", {
			error: error instanceof Error ? error.message : String(error),
		});
		return { intent: "UNKNOWN", params: {} };
	}
}

async function getLoginState(chatId: string): Promise<LoginState | null> {
	const record = await db.verification.findFirst({
		where: {
			identifier: `${LOGIN_STATE_PREFIX}${chatId}`,
			expiresAt: { gt: new Date() },
		},
	});
	if (!record) {
		return null;
	}
	try {
		return JSON.parse(record.value) as LoginState;
	} catch {
		return null;
	}
}

async function setLoginState(chatId: string, state: LoginState): Promise<void> {
	const identifier = `${LOGIN_STATE_PREFIX}${chatId}`;
	const expiresAt = new Date(Date.now() + LOGIN_STATE_TTL_MS);
	const now = new Date();
	await db.verification.deleteMany({ where: { identifier } });
	await db.verification.create({
		data: {
			identifier,
			value: JSON.stringify(state),
			expiresAt,
			createdAt: now,
			updatedAt: now,
		},
	});
}

async function clearLoginState(chatId: string): Promise<void> {
	await db.verification.deleteMany({
		where: { identifier: `${LOGIN_STATE_PREFIX}${chatId}` },
	});
}

// Atomically consumes the login state on a successful OTP check: the delete
// is scoped to the exact serialized `state` just read, so a concurrent second
// submission of the same correct code (which read the same row) loses the
// race — its delete matches zero rows instead of both submissions succeeding.
async function consumeLoginState(
	chatId: string,
	state: LoginState,
): Promise<boolean> {
	const result = await db.verification.deleteMany({
		where: {
			identifier: `${LOGIN_STATE_PREFIX}${chatId}`,
			value: JSON.stringify(state),
		},
	});
	return result.count === 1;
}

function generateOtp(): string {
	return String(randomInt(100000, 1000000));
}

const CLASSIFICATION_SCHEMA = z.object({
	items: z.array(
		z.object({
			id: z.string(),
			category: z.enum(["HANDLE_NOW", "CHECK_TODAY", "FYI"]),
			reason: z.string().max(220),
		}),
	),
});

export async function createTelegramConnectLink(userId: string) {
	const token = await createTelegramLinkToken(userId);
	return {
		url: buildStartLink(`${LINK_PREFIX}${token.token}`),
		expiresAt: token.expiresAt,
	};
}

export async function getTelegramUserStatus(userId: string) {
	const connection = await getTelegramConnectionByUserId(userId);
	return {
		connected: !!connection,
		enabled: connection?.enabled ?? false,
		username: connection?.username ?? null,
		firstName: connection?.firstName ?? null,
		lastName: connection?.lastName ?? null,
		timezone: connection?.timezone ?? DEFAULT_TIME_ZONE,
		dailyDigestTime: connection?.dailyDigestTime ?? DEFAULT_DIGEST_TIME,
		// Lets the web UI tell a brand-new scan apart from an existing connection
		// (upsert bumps updatedAt), so a pending QR can auto-hide on connect.
		updatedAt: connection?.updatedAt.toISOString() ?? null,
	};
}

export async function disconnectTelegramForUser(userId: string) {
	return setTelegramDeliveryForUser(userId, false);
}

export async function setTelegramDeliveryForUser(
	userId: string,
	enabled: boolean,
) {
	const connection = await getTelegramConnectionByUserId(userId);
	if (!connection) {
		return { updated: false };
	}
	await updateTelegramConnection(connection.id, { enabled });
	return { updated: true, enabled };
}

export async function handleTelegramUpdate(update: TelegramUpdate) {
	if (update.message?.text) {
		await handleTelegramMessage(update.message);
		return;
	}

	if (update.callback_query) {
		await handleTelegramCallback(update.callback_query);
	}
}

export async function sendDueTelegramDigests(now = new Date()) {
	const connections = await listEnabledTelegramConnections();
	let sent = 0;
	let skipped = 0;

	for (const connection of connections) {
		if (!isDigestDue(connection, now)) {
			skipped++;
			continue;
		}

		try {
			await sendBriefingForConnection(connection, {
				manual: false,
				now,
			});
			await updateTelegramConnection(connection.id, {
				lastBriefingSentAt: now,
			});
			sent++;
		} catch (error) {
			logger.error("[telegram] Failed to send due digest", {
				connectionId: connection.id,
				userId: connection.userId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return { sent, skipped, checked: connections.length };
}

async function handleTelegramMessage(message: TelegramMessage) {
	const chatId = String(message.chat.id);
	const text = message.text?.trim() ?? "";

	if (message.chat.type !== "private") {
		await sendTelegramMessage(
			chatId,
			"Please open a private chat with this bot to connect your email briefing.",
		);
		return;
	}

	// OTP login flow takes priority
	if (!text.startsWith("/")) {
		const state = await getLoginState(chatId);
		if (state) {
			if (state.step === "email") {
				await handleEmailInput(chatId, text);
			} else {
				await handleOtpInput(chatId, text, message.from ?? { id: 0 });
			}
			return;
		}
	}

	// Hard commands that stay exact
	const [rawCommand = "", ...args] = text.split(/\s+/);
	const command = rawCommand.toLowerCase().replace(/@[\w_]+$/, "");
	if (command === "/start") {
		await handleStartCommand(message, args[0]);
		return;
	}
	if (command === "/login") {
		await handleLoginCommand(chatId);
		return;
	}
	if (command === "/connect") {
		await sendConnectInstructions(chatId);
		return;
	}

	// Everything else → NL router
	await nlRouter(chatId, text, message.from ?? { id: 0 });
}

// ── NL Router ─────────────────────────────────────────────────────────────────

async function nlRouter(chatId: string, text: string, from: TelegramUser) {
	const ctx = await getConvCtx(chatId);

	// Pending confirmation flow
	if (ctx.pendingAction) {
		const quick: ParsedIntent = await (async () => {
			if (!process.env.SARVAM_API_KEY) {
				return { intent: "UNKNOWN", params: {} } as ParsedIntent;
			}
			try {
				return await generateWithSarvam({
					schema: INTENT_SCHEMA,
					temperature: 0,
					system: 'Classify only: is this a confirmation (yes/ok/send/sure/do it) → CONFIRM_YES, or cancellation (no/cancel/stop) → CONFIRM_NO, or something else → UNKNOWN. Respond with a single JSON object {"intent": "CONFIRM_YES"|"CONFIRM_NO"|"UNKNOWN", "params": {}}.',
					prompt: text,
				});
			} catch {
				return { intent: "UNKNOWN", params: {} } as ParsedIntent;
			}
		})();
		if (quick.intent === "CONFIRM_YES") {
			await executePendingAction(chatId, ctx, from);
			return;
		}
		if (quick.intent === "CONFIRM_NO") {
			await setConvCtx(chatId, { ...ctx, pendingAction: undefined });
			await sendTelegramMessage(chatId, "Cancelled.");
			return;
		}
		// Not a yes/no — clear pending and process as new intent
		await setConvCtx(chatId, { ...ctx, pendingAction: undefined });
	}

	const parsed = await classifyIntent(text, await getConvCtx(chatId));
	await dispatchIntent(chatId, parsed, ctx, from);
}

async function dispatchIntent(
	chatId: string,
	parsed: ParsedIntent,
	ctx: ConvCtx,
	_from: TelegramUser,
) {
	switch (parsed.intent) {
		case "INBOX_LIST":
			await nlInboxList(chatId, parsed.params.folder ?? "inbox", ctx);
			break;
		case "EMAIL_READ":
			await nlEmailRead(chatId, parsed.params, ctx);
			break;
		case "EMAIL_ACTION":
			await nlEmailAction(chatId, parsed.params, ctx);
			break;
		case "EMAIL_SEND":
			await nlEmailSend(chatId, parsed.params, ctx);
			break;
		case "EMAIL_REPLY":
			await nlEmailReply(chatId, parsed.params, ctx);
			break;
		case "EMAIL_FORWARD":
			await nlEmailForward(chatId, parsed.params, ctx);
			break;
		case "RULE_LIST":
			await nlRuleList(chatId, ctx);
			break;
		case "RULE_CREATE":
			await nlRuleCreate(chatId, parsed.params.rulePrompt ?? "", ctx);
			break;
		case "RULE_TOGGLE":
			await nlRuleToggle(chatId, parsed.params, ctx);
			break;
		case "RULE_DELETE":
			await nlRuleDelete(chatId, parsed.params, ctx);
			break;
		case "RULE_SUGGESTIONS":
			await nlRuleSuggestions(chatId);
			break;
		case "CALENDAR_LIST":
			await nlCalendarList(chatId, parsed.params.dateExpr ?? "today");
			break;
		case "STATS":
			await nlStats(chatId);
			break;
		case "ACTIVITY":
			await nlActivity(chatId);
			break;
		case "MAILBOX_LIST":
			await nlMailboxList(chatId);
			break;
		case "SETTINGS_VIEW":
			await sendSettings(chatId);
			break;
		case "SETTINGS_UPDATE":
			await nlSettingsUpdate(chatId, parsed.params);
			break;
		case "SYNC":
			await sendSyncEmails(chatId);
			break;
		case "BRIEF":
			await sendManualBrief(chatId);
			break;
		case "DAY":
			await sendDaySummary(chatId);
			break;
		case "WHATNEXT":
			await sendWhatNext(chatId);
			break;
		case "HELP":
			await sendHelp(chatId);
			break;
		default:
			await sendTelegramMessage(
				chatId,
				'I didn\'t quite get that. Try "show inbox", "what\'s on my calendar?", "show my rules", or ask for /help.',
			);
	}
}

async function executePendingAction(
	chatId: string,
	ctx: ConvCtx,
	_from: TelegramUser,
) {
	const pending = ctx.pendingAction;
	if (!pending) {
		return;
	}
	await setConvCtx(chatId, { ...ctx, pendingAction: undefined });

	if (
		pending.type === "send" ||
		pending.type === "reply" ||
		pending.type === "forward"
	) {
		const {
			to,
			subject,
			body,
			accountId,
			provider,
			email: senderEmail,
		} = pending.data as Record<string, string>;
		try {
			if (provider === "OUTLOOK") {
				const { sendOutlookMessage } = await import(
					"../mailboxes/lib/outlook-client"
				);
				await sendOutlookMessage(accountId, { to, subject, body });
			} else {
				const { sendMessage } = await import(
					"../mailboxes/lib/gmail-client"
				);
				const headers = [
					`From: ${senderEmail ?? ""}`,
					`To: ${to}`,
					`Subject: ${subject}`,
					`Content-Type: text/plain; charset="UTF-8"`,
					"MIME-Version: 1.0",
				].join("\r\n");
				const raw = Buffer.from(`${headers}\r\n\r\n${body}`)
					.toString("base64")
					.replace(/\+/g, "-")
					.replace(/\//g, "_")
					.replace(/=+$/, "");
				await sendMessage(accountId, raw);
			}
			await sendTelegramMessage(chatId, `Sent to ${to}.`);
		} catch {
			await sendTelegramMessage(
				chatId,
				"Failed to send. Check your mailbox connection in Zeromail.",
			);
		}
		return;
	}

	if (pending.type === "delete_rule") {
		const { ruleId } = pending.data as { ruleId: string };
		try {
			await db.rule.delete({ where: { id: ruleId } });
			await sendTelegramMessage(chatId, "Rule deleted.");
		} catch {
			await sendTelegramMessage(chatId, "Failed to delete rule.");
		}
		return;
	}

	if (pending.type === "create_rule") {
		const { mailboxId, rule } = pending.data as {
			mailboxId: string;
			rule: { name: string; condition: unknown; actions: unknown[] };
		};
		try {
			await db.rule.create({
				data: {
					mailboxId,
					name: rule.name,
					enabled: true,
					condition: rule.condition as Parameters<
						typeof db.rule.create
					>[0]["data"]["condition"],
					actions: rule.actions as Parameters<
						typeof db.rule.create
					>[0]["data"]["actions"],
				},
			});
			await sendTelegramMessage(chatId, "Rule created and enabled.");
		} catch {
			await sendTelegramMessage(chatId, "Failed to save rule.");
		}
		return;
	}
}

// ── Inbox handlers ────────────────────────────────────────────────────────────

async function nlInboxList(chatId: string, folder: string, ctx: ConvCtx) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	if (!mailboxes.length) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}
	const mailbox = mailboxes[0];

	const labelFilter: Record<string, string> = {
		inbox: "INBOX",
		sent: "SENT",
		trash: "TRASH",
		spam: "SPAM",
	};
	const labelId = labelFilter[folder] ?? "INBOX";
	const emailWhere =
		folder === "inbox"
			? {
					mailboxId: mailbox.id,
					labelIds: { has: labelId },
					isUnread: true,
				}
			: { mailboxId: mailbox.id, labelIds: { has: labelId } };

	const emails = await db.email.findMany({
		where: emailWhere,
		orderBy: { internalDate: "desc" },
		take: 10,
		select: {
			id: true,
			mailboxId: true,
			from: true,
			fromEmail: true,
			subject: true,
			snippet: true,
			internalDate: true,
		},
	});

	if (!emails.length) {
		await sendTelegramMessage(chatId, `No emails in ${folder}.`);
		return;
	}

	const list: EmailRef[] = emails.map((e) => ({
		id: e.id,
		mailboxId: e.mailboxId,
		subject: e.subject || "(no subject)",
		from: e.fromEmail || e.from || "",
	}));
	await setConvCtx(chatId, { ...ctx, lastEmailList: list });

	const lines = [
		`${folder === "inbox" ? "Unread inbox" : folder.charAt(0).toUpperCase() + folder.slice(1)} — ${mailbox.email}`,
		"",
	];
	emails.forEach((e, i) => {
		lines.push(
			`${i + 1}. ${compactSubject(e.subject)} — ${compactLine(e.fromEmail || e.from || "", 35)}`,
		);
	});
	lines.push(
		"",
		'Reply with "read 3" to open an email, or "archive 2" to act on one.',
	);
	await sendTelegramMessage(chatId, lines.join("\n"));
}

async function nlEmailRead(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	let emailRef: EmailRef | undefined;
	if (params.emailIndex && ctx.lastEmailList) {
		emailRef = ctx.lastEmailList[params.emailIndex - 1];
	} else if (params.emailSearch && ctx.lastEmailList) {
		const q = params.emailSearch.toLowerCase();
		emailRef = ctx.lastEmailList.find(
			(e) =>
				e.subject.toLowerCase().includes(q) ||
				e.from.toLowerCase().includes(q),
		);
	}

	if (!emailRef) {
		await sendTelegramMessage(
			chatId,
			'Which email? Say "show inbox" first, then "read 2" to open one.',
		);
		return;
	}

	const email = await db.email.findUnique({
		where: { id: emailRef.id },
		select: {
			id: true,
			from: true,
			fromEmail: true,
			subject: true,
			bodyText: true,
			snippet: true,
			internalDate: true,
			isUnread: true,
		},
	});
	if (!email) {
		await sendTelegramMessage(chatId, "Email not found.");
		return;
	}

	const body = (email.bodyText || email.snippet || "").slice(0, 3800);
	const date = email.internalDate
		? new Date(email.internalDate).toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			})
		: "";
	const lines = [
		`From: ${email.from || email.fromEmail}`,
		`Subject: ${email.subject || "(no subject)"}`,
		date ? `Date: ${date}` : "",
		"",
		body,
		"",
		'Actions: "archive it", "trash it", "mark as read", "reply saying ...", "forward to ..."',
	].filter((l) => l !== undefined);

	await setConvCtx(chatId, {
		...ctx,
		lastEmailId: emailRef.id,
		lastEmailMailboxId: emailRef.mailboxId,
	});
	await sendTelegramMessage(chatId, lines.join("\n"));
}

async function nlEmailAction(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	let emailId = ctx.lastEmailId;
	let mailboxId = ctx.lastEmailMailboxId;

	if (params.emailIndex && ctx.lastEmailList) {
		const ref = ctx.lastEmailList[params.emailIndex - 1];
		if (ref) {
			emailId = ref.id;
			mailboxId = ref.mailboxId;
		}
	}

	if (!emailId || !mailboxId) {
		await sendTelegramMessage(
			chatId,
			'Which email? Open one first with "read 2".',
		);
		return;
	}

	const mailbox = (connection.user.mailbox as MailboxForDigest[]).find(
		(m) => m.id === mailboxId,
	);
	if (!mailbox) {
		await sendTelegramMessage(chatId, "Mailbox not found.");
		return;
	}

	const action = (params.action ?? "archive") as
		| "archive"
		| "trash"
		| "markRead"
		| "markUnread";
	const gmailAction =
		action === "archive"
			? "ARCHIVE"
			: action === "trash"
				? "TRASH"
				: action === "markUnread"
					? "MARK_READ"
					: "MARK_READ";

	try {
		if (mailbox.provider === "OUTLOOK") {
			await runOutlookAction(mailbox.accountId, emailId, gmailAction);
		} else {
			await runGmailAction(mailbox.accountId, emailId, gmailAction);
		}
		const labels: Record<string, string> = {
			archive: "Archived",
			trash: "Moved to trash",
			markRead: "Marked as read",
			markUnread: "Marked as unread",
		};
		await sendTelegramMessage(chatId, `${labels[action] ?? "Done"}.`);
	} catch {
		await sendTelegramMessage(
			chatId,
			"Action failed. Check your mailbox connection.",
		);
	}
}

async function nlEmailSend(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailbox = (connection.user.mailbox as MailboxForDigest[])[0];
	if (!mailbox) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	const to = params.to ?? "";
	const subject = params.subject ?? "(no subject)";
	const body = params.body ?? "";

	if (!to) {
		await sendTelegramMessage(
			chatId,
			'Who should I send it to? Say "send email to name@example.com about subject".',
		);
		return;
	}

	await setConvCtx(chatId, {
		...ctx,
		pendingAction: {
			type: "send",
			data: {
				mailboxId: mailbox.id,
				accountId: mailbox.accountId,
				provider: mailbox.provider,
				email: mailbox.email,
				to,
				subject,
				body,
			},
		},
	});
	await sendTelegramMessage(
		chatId,
		`Ready to send:\nTo: ${to}\nSubject: ${subject}\n${body ? `\n${body.slice(0, 200)}\n` : ""}\nSend? (yes / no)`,
	);
}

async function nlEmailReply(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	if (!ctx.lastEmailId) {
		await sendTelegramMessage(
			chatId,
			'Open an email first, then say "reply saying ...".',
		);
		return;
	}

	const email = await db.email.findUnique({
		where: { id: ctx.lastEmailId },
		select: { fromEmail: true, subject: true },
	});
	if (!email) {
		await sendTelegramMessage(chatId, "Email not found.");
		return;
	}

	const mailbox =
		(connection.user.mailbox as MailboxForDigest[]).find(
			(m) => m.id === ctx.lastEmailMailboxId,
		) ?? (connection.user.mailbox as MailboxForDigest[])[0];
	if (!mailbox) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	const to = params.to ?? email.fromEmail ?? "";
	const subject = `Re: ${email.subject ?? ""}`;
	const body = params.body ?? "";

	await setConvCtx(chatId, {
		...ctx,
		pendingAction: {
			type: "reply",
			data: {
				mailboxId: mailbox.id,
				accountId: mailbox.accountId,
				provider: mailbox.provider,
				email: mailbox.email,
				to,
				subject,
				body,
			},
		},
	});
	await sendTelegramMessage(
		chatId,
		`Reply to: ${to}\nSubject: ${subject}\n\n${body.slice(0, 200)}\n\nSend? (yes / no)`,
	);
}

async function nlEmailForward(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	if (!ctx.lastEmailId) {
		await sendTelegramMessage(
			chatId,
			'Open an email first, then say "forward to ...".',
		);
		return;
	}

	const email = await db.email.findUnique({
		where: { id: ctx.lastEmailId },
		select: { subject: true, bodyText: true, from: true },
	});
	if (!email) {
		await sendTelegramMessage(chatId, "Email not found.");
		return;
	}

	const mailbox =
		(connection.user.mailbox as MailboxForDigest[]).find(
			(m) => m.id === ctx.lastEmailMailboxId,
		) ?? (connection.user.mailbox as MailboxForDigest[])[0];
	if (!mailbox) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	const to = params.to ?? "";
	if (!to) {
		await sendTelegramMessage(
			chatId,
			'Forward to whom? Say "forward to name@example.com".',
		);
		return;
	}

	const subject = `Fwd: ${email.subject ?? ""}`;
	const body = `---------- Forwarded message ----------\nFrom: ${email.from}\n\n${(email.bodyText ?? "").slice(0, 2000)}`;

	await setConvCtx(chatId, {
		...ctx,
		pendingAction: {
			type: "forward",
			data: {
				mailboxId: mailbox.id,
				accountId: mailbox.accountId,
				provider: mailbox.provider,
				email: mailbox.email,
				to,
				subject,
				body,
			},
		},
	});
	await sendTelegramMessage(
		chatId,
		`Forward to: ${to}\nSubject: ${subject}\n\nSend? (yes / no)`,
	);
}

// ── Rules handlers ────────────────────────────────────────────────────────────

async function nlRuleList(chatId: string, ctx: ConvCtx) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	if (!mailboxes.length) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	const rules = await db.rule.findMany({
		where: { mailboxId: { in: mailboxes.map((m) => m.id) } },
		orderBy: { createdAt: "desc" },
		select: { id: true, name: true, enabled: true, mailboxId: true },
	});
	if (!rules.length) {
		await sendTelegramMessage(
			chatId,
			'No rules yet. Say "create a rule to archive newsletters" to add one.',
		);
		return;
	}

	const ruleRefs: RuleRef[] = rules.map((r) => ({
		id: r.id,
		mailboxId: r.mailboxId,
		name: r.name,
		enabled: r.enabled,
	}));
	await setConvCtx(chatId, { ...ctx, lastRuleList: ruleRefs });

	const lines = ["Your rules:", ""];
	for (let i = 0; i < rules.length; i++) {
		lines.push(
			`${i + 1}. ${rules[i].name} — ${rules[i].enabled ? "on" : "off"}`,
		);
	}
	lines.push(
		"",
		'Say "disable rule 2", "enable rule 1", or "delete rule 3".',
	);
	await sendTelegramMessage(chatId, lines.join("\n"));
}

async function nlRuleCreate(chatId: string, rulePrompt: string, ctx: ConvCtx) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailbox = (connection.user.mailbox as MailboxForDigest[])[0];
	if (!mailbox) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}
	if (!rulePrompt.trim()) {
		await sendTelegramMessage(
			chatId,
			'Describe the rule, e.g. "archive all newsletters".',
		);
		return;
	}

	await sendTelegramMessage(chatId, "Compiling rule...");

	if (!process.env.SARVAM_API_KEY) {
		await sendTelegramMessage(chatId, "AI rule creation is not available.");
		return;
	}

	try {
		const RULE_SCHEMA = z.object({
			name: z.string(),
			condition: z.object({
				conditionalOperator: z.enum(["AND", "OR", "NONE"]).nullable(),
				aiInstructions: z.string().nullable(),
				staticFrom: z.string().nullable(),
				staticTo: z.string().nullable(),
				staticSubject: z.string().nullable(),
			}),
			actions: z.array(
				z.object({
					type: z.enum([
						"LABEL",
						"ARCHIVE",
						"MARK_READ",
						"DRAFT_EMAIL",
						"REPLY",
						"FORWARD",
						"MARK_SPAM",
					]),
					label: z.string().optional(),
					to: z.string().optional(),
				}),
			),
		});
		const object = await generateWithSarvam({
			schema: RULE_SCHEMA,
			temperature: 0.1,
			system: `Convert this email rule request into a structured rule. Return a single rule.

OUTPUT FORMAT: respond with a single JSON object of exactly this shape — no extra text:
{"name": string, "condition": {"conditionalOperator": "AND"|"OR"|"NONE"|null, "aiInstructions": string|null, "staticFrom": string|null, "staticTo": string|null, "staticSubject": string|null}, "actions": [{"type": "LABEL"|"ARCHIVE"|"MARK_READ"|"DRAFT_EMAIL"|"REPLY"|"FORWARD"|"MARK_SPAM", "label"?: string, "to"?: string}, ...]}
Use null for any condition field that doesn't apply.`,
			prompt: rulePrompt,
		});

		const preview = [
			`Rule: ${object.name}`,
			object.condition.aiInstructions
				? `Condition: ${object.condition.aiInstructions}`
				: "",
			object.condition.staticFrom
				? `From: ${object.condition.staticFrom}`
				: "",
			`Actions: ${object.actions.map((a) => a.type + (a.label ? ` (${a.label})` : "") + (a.to ? ` → ${a.to}` : "")).join(", ")}`,
			"",
			"Create this rule? (yes / no)",
		]
			.filter(Boolean)
			.join("\n");

		await setConvCtx(chatId, {
			...ctx,
			pendingAction: {
				type: "create_rule",
				data: {
					mailboxId: mailbox.id,
					rule: {
						name: object.name,
						condition: {
							conditionalOperator:
								object.condition.conditionalOperator === "NONE"
									? null
									: object.condition.conditionalOperator,
							aiInstructions: object.condition.aiInstructions,
							static:
								object.condition.staticFrom ||
								object.condition.staticTo ||
								object.condition.staticSubject
									? {
											from: object.condition.staticFrom,
											to: object.condition.staticTo,
											subject:
												object.condition.staticSubject,
										}
									: null,
						},
						actions: object.actions,
					},
				},
			},
		});
		await sendTelegramMessage(chatId, preview);
	} catch {
		await sendTelegramMessage(
			chatId,
			'Couldn\'t compile that rule. Try being more specific, e.g. "archive emails from newsletters@example.com".',
		);
	}
}

async function nlRuleToggle(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	let rule: RuleRef | undefined;
	if (params.ruleIndex && ctx.lastRuleList) {
		rule = ctx.lastRuleList[params.ruleIndex - 1];
	} else if (params.ruleName && ctx.lastRuleList) {
		const q = params.ruleName.toLowerCase();
		rule = ctx.lastRuleList.find((r) => r.name.toLowerCase().includes(q));
	}

	if (!rule) {
		await sendTelegramMessage(
			chatId,
			'Which rule? Say "show my rules" first, then "disable rule 2".',
		);
		return;
	}

	const enabled = params.enabled ?? !rule.enabled;
	await db.rule.update({ where: { id: rule.id }, data: { enabled } });
	await sendTelegramMessage(
		chatId,
		`Rule "${rule.name}" ${enabled ? "enabled" : "disabled"}.`,
	);
	await setConvCtx(chatId, {
		...ctx,
		lastRuleList: ctx.lastRuleList?.map((r) =>
			r.id === rule?.id ? { ...r, enabled } : r,
		),
	});
}

async function nlRuleDelete(
	chatId: string,
	params: ParsedIntent["params"],
	ctx: ConvCtx,
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	let rule: RuleRef | undefined;
	if (params.ruleIndex && ctx.lastRuleList) {
		rule = ctx.lastRuleList[params.ruleIndex - 1];
	} else if (params.ruleName && ctx.lastRuleList) {
		const q = params.ruleName.toLowerCase();
		rule = ctx.lastRuleList.find((r) => r.name.toLowerCase().includes(q));
	}

	if (!rule) {
		await sendTelegramMessage(
			chatId,
			'Which rule? Say "show my rules" first, then "delete rule 2".',
		);
		return;
	}

	await setConvCtx(chatId, {
		...ctx,
		pendingAction: { type: "delete_rule", data: { ruleId: rule.id } },
	});
	await sendTelegramMessage(chatId, `Delete rule "${rule.name}"? (yes / no)`);
}

async function nlRuleSuggestions(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailbox = (connection.user.mailbox as MailboxForDigest[])[0];
	if (!mailbox) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	await sendTelegramMessage(
		chatId,
		"Analysing your inbox for rule suggestions...",
	);

	const topSenders = await db.email.groupBy({
		by: ["fromEmail"],
		where: { mailboxId: mailbox.id },
		_count: { id: true },
		orderBy: { _count: { id: "desc" } },
		take: 10,
	});
	if (!topSenders.length) {
		await sendTelegramMessage(
			chatId,
			"Not enough email history to suggest rules. Try /sync first.",
		);
		return;
	}

	const lines = ["Rule suggestions based on your top senders:", ""];
	topSenders.slice(0, 5).forEach((s, i) => {
		lines.push(
			`${i + 1}. Archive all from ${s.fromEmail} (${s._count.id} emails)`,
		);
	});
	lines.push(
		"",
		'Say "create a rule to archive emails from X" to set one up.',
	);
	await sendTelegramMessage(chatId, lines.join("\n"));
}

// ── Calendar handler ──────────────────────────────────────────────────────────

async function nlCalendarList(chatId: string, dateExpr: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	const googleMailboxes = mailboxes.filter((m) => m.provider === "GOOGLE");
	if (!googleMailboxes.length) {
		await sendTelegramMessage(
			chatId,
			"Calendar events require a connected Google account.",
		);
		return;
	}

	const now = new Date();
	const { timeMin, timeMax } = resolveDateExpr(
		dateExpr,
		now,
		connection.timezone,
	);

	for (const mailbox of googleMailboxes) {
		try {
			const events = await listUpcomingEvents(mailbox.accountId, {
				timeMin: timeMin.toISOString(),
				timeMax: timeMax.toISOString(),
				maxResults: 15,
			});
			if (!events.length) {
				await sendTelegramMessage(
					chatId,
					`No events for ${dateExpr} — ${mailbox.email}.`,
				);
				continue;
			}
			const lines = [`Calendar — ${dateExpr} — ${mailbox.email}`, ""];
			for (const event of events) {
				if (event.isAllDay) {
					lines.push(`📅 ${event.summary ?? "(No title)"} — All day`);
				} else if (event.start) {
					const time = formatEventTime(
						event.start,
						connection.timezone,
					);
					const rel = formatRelativeTime(event.start, now);
					lines.push(
						`📅 ${event.summary ?? "(No title)"} — ${time} (${rel})`,
					);
				}
				if (event.location) {
					lines.push(`   ${compactLine(event.location, 60)}`);
				}
			}
			await sendTelegramMessage(chatId, lines.join("\n"));
		} catch {
			await sendTelegramMessage(
				chatId,
				`Could not fetch calendar for ${mailbox.email}.`,
			);
		}
	}
}

function resolveDateExpr(
	expr: string,
	now: Date,
	timezone: string,
): { timeMin: Date; timeMax: Date } {
	const local = getLocalParts(now, timezone);
	const todayStr = local.dateKey;
	const d = expr.toLowerCase().trim();

	if (d === "today" || d === "") {
		const { start, end } = getTodayBounds(timezone, now);
		return { timeMin: start, timeMax: end };
	}
	if (d === "tomorrow") {
		const { start } = getTodayBounds(
			timezone,
			new Date(now.getTime() + 86400000),
		);
		return {
			timeMin: start,
			timeMax: new Date(start.getTime() + 86400000),
		};
	}
	if (d === "this week" || d === "week") {
		const { start } = getTodayBounds(timezone, now);
		return {
			timeMin: start,
			timeMax: new Date(start.getTime() + 7 * 86400000),
		};
	}
	if (d === "next week") {
		const { start } = getTodayBounds(
			timezone,
			new Date(now.getTime() + 7 * 86400000),
		);
		return {
			timeMin: start,
			timeMax: new Date(start.getTime() + 7 * 86400000),
		};
	}
	// Day name like "monday"
	const days = [
		"sunday",
		"monday",
		"tuesday",
		"wednesday",
		"thursday",
		"friday",
		"saturday",
	];
	const target = days.indexOf(d);
	if (target >= 0) {
		const currentDay = new Date(`${todayStr}T12:00:00Z`).getDay();
		let diff = target - currentDay;
		if (diff <= 0) {
			diff += 7;
		}
		const { start } = getTodayBounds(
			timezone,
			new Date(now.getTime() + diff * 86400000),
		);
		return {
			timeMin: start,
			timeMax: new Date(start.getTime() + 86400000),
		};
	}
	// Default: next 24h
	return { timeMin: now, timeMax: new Date(now.getTime() + 86400000) };
}

// ── Analytics & logs ──────────────────────────────────────────────────────────

async function nlStats(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	if (!mailboxes.length) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	const lines = ["Your Zeromail stats:", ""];
	for (const mailbox of mailboxes) {
		const [total, unread, rules] = await Promise.all([
			db.email.count({ where: { mailboxId: mailbox.id } }),
			db.email.count({
				where: {
					mailboxId: mailbox.id,
					isUnread: true,
					labelIds: { has: "INBOX" },
				},
			}),
			db.rule.count({ where: { mailboxId: mailbox.id } }),
		]);
		lines.push(`${mailbox.email}`);
		lines.push(`  Emails in DB: ${total}`);
		lines.push(`  Unread inbox: ${unread}`);
		lines.push(`  Rules: ${rules}`);
		lines.push("");
	}
	await sendTelegramMessage(chatId, lines.join("\n").trim());
}

async function nlActivity(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	if (!mailboxes.length) {
		await sendTelegramMessage(chatId, "No mailbox connected.");
		return;
	}

	const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const logs = await db.ruleExecutionLog.findMany({
		where: {
			mailboxId: { in: mailboxes.map((m) => m.id) },
			createdAt: { gte: since },
		},
		orderBy: { createdAt: "desc" },
		take: 10,
		select: {
			id: true,
			status: true,
			createdAt: true,
			ruleId: true,
			subject: true,
			from: true,
		},
	});

	if (!logs.length) {
		await sendTelegramMessage(
			chatId,
			"No rule activity in the last 24 hours.",
		);
		return;
	}

	// Fetch rule names in bulk
	const ruleIds = [...new Set(logs.map((l) => l.ruleId).filter(Boolean))];
	const rules = ruleIds.length
		? await db.rule.findMany({
				where: { id: { in: ruleIds } },
				select: { id: true, name: true },
			})
		: [];
	const ruleMap = new Map(rules.map((r) => [r.id, r.name]));

	const lines = ["Rule activity — last 24h:", ""];
	for (const log of logs) {
		const status =
			log.status === "matched" ? "✓" : log.status === "error" ? "✗" : "—";
		const subject = compactSubject(log.subject ?? "(no subject)");
		const ruleName = ruleMap.get(log.ruleId) ?? "unknown rule";
		lines.push(`${status} ${ruleName}: ${subject}`);
	}
	await sendTelegramMessage(chatId, lines.join("\n"));
}

// ── Mailbox & settings ────────────────────────────────────────────────────────

async function nlMailboxList(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}
	const mailboxes = connection.user.mailbox as (MailboxForDigest & {
		watchEnabled?: boolean;
	})[];

	if (!mailboxes.length) {
		await sendTelegramMessage(
			chatId,
			"No mailboxes connected. Add one in Zeromail settings.",
		);
		return;
	}

	const lines = ["Connected mailboxes:", ""];
	for (const m of mailboxes) {
		lines.push(
			`${m.provider === "GOOGLE" ? "Gmail" : "Outlook"}: ${m.email}`,
		);
	}
	await sendTelegramMessage(chatId, lines.join("\n"));
}

async function nlSettingsUpdate(
	chatId: string,
	params: ParsedIntent["params"],
) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	const updates: Parameters<typeof updateTelegramConnection>[1] = {};
	if (params.digestTime) {
		updates.dailyDigestTime = params.digestTime;
	}
	if (params.timezone) {
		updates.timezone = params.timezone;
	}

	if (!Object.keys(updates).length) {
		await sendTelegramMessage(
			chatId,
			'What would you like to change? Try "change digest time to 8am" or "set timezone to IST".',
		);
		return;
	}

	await updateTelegramConnection(connection.id, updates);
	const parts = [];
	if (params.digestTime) {
		parts.push(`digest time → ${params.digestTime}`);
	}
	if (params.timezone) {
		parts.push(`timezone → ${params.timezone}`);
	}
	await sendTelegramMessage(chatId, `Updated: ${parts.join(", ")}.`);
}

async function handleStartCommand(message: TelegramMessage, arg?: string) {
	const chatId = String(message.chat.id);
	if (arg?.startsWith(LINK_PREFIX)) {
		await connectTelegramAccount(message, arg.slice(LINK_PREFIX.length));
		return;
	}

	await sendTelegramMessage(
		chatId,
		[
			"Welcome to Zeromail.",
			"",
			"Use /login to connect with your email address.",
			"Or use /connect if you are already logged in to the web app.",
			"",
			"After connecting, use /brief for your inbox briefing.",
		].join("\n"),
	);
}

async function connectTelegramAccount(message: TelegramMessage, token: string) {
	const chatId = String(message.chat.id);
	const from = message.from;

	if (!from) {
		await sendTelegramMessage(
			chatId,
			"Telegram did not include a user for this message. Please try again.",
		);
		return;
	}

	const linkToken = await consumeTelegramLinkToken(token);

	if (!linkToken) {
		await sendTelegramMessage(
			chatId,
			"This connection link is expired or already used. Generate a new link from Zeromail.",
		);
		return;
	}

	await upsertTelegramConnection({
		userId: linkToken.userId,
		telegramUserId: String(from.id),
		chatId,
		username: from.username ?? null,
		firstName: from.first_name ?? null,
		lastName: from.last_name ?? null,
		languageCode: from.language_code ?? null,
	});

	await sendTelegramMessage(
		chatId,
		[
			"Welcome to Mail Monkey Bot.",
			"",
			"Commands:",
			"/help - navigate what you can do",
			"/settings - show digest settings",
			"/pause - pause daily briefings",
		].join("\n"),
	);
}

async function sendManualBrief(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	await sendTelegramMessage(chatId, "Preparing your inbox briefing...");
	await sendBriefingForConnection(connection, {
		manual: true,
		now: new Date(),
	});
}

async function sendSettings(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	await sendTelegramMessage(
		chatId,
		[
			"Telegram briefing settings",
			"",
			`Status: ${connection.enabled ? "enabled" : "paused"}`,
			`Daily time: ${connection.dailyDigestTime}`,
			`Timezone: ${connection.timezone}`,
			`Mailboxes: ${connection.user.mailbox.length}`,
			"",
			"Use /pause or /resume to change delivery.",
		].join("\n"),
	);
}

async function _setConnectionEnabled(chatId: string, enabled: boolean) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	await updateTelegramConnection(connection.id, { enabled });
	await sendTelegramMessage(
		chatId,
		enabled
			? "Daily Telegram briefings are enabled."
			: "Daily Telegram briefings are paused. Use /resume to turn them back on.",
	);
}

async function sendConnectInstructions(chatId: string) {
	await sendTelegramMessage(
		chatId,
		[
			"This Telegram chat is not linked yet.",
			"",
			"Option 1 — connect with email code:",
			"Use /login and enter your email address.",
			"",
			"Option 2 — connect via web:",
			`Open ${getBaseUrl()}/api/telegram/link while logged in to Zeromail.`,
		].join("\n"),
	);
}

async function sendHelp(chatId: string) {
	await sendTelegramMessage(
		chatId,
		[
			"Zeromail — just talk to me naturally.",
			"",
			"Inbox:",
			'  "show my inbox" / "check sent" / "check trash"',
			'  "read email 3" / "open the one from Google"',
			'  "archive it" / "trash it" / "mark as read"',
			'  "reply saying I\'ll be there"',
			'  "forward to boss@company.com"',
			"",
			"Rules:",
			'  "show my rules"',
			'  "create a rule to archive newsletters"',
			'  "disable rule 2" / "enable the newsletter rule"',
			'  "delete rule 1" / "suggest rules for me"',
			"",
			"Calendar:",
			'  "what\'s on my calendar today?"',
			'  "tomorrow\'s schedule" / "show Monday events"',
			"",
			"Analytics & settings:",
			'  "show my stats" / "recent activity"',
			'  "what mailboxes are connected?"',
			'  "change digest time to 8am"',
			"",
			"Briefings:",
			'  "give me a briefing" / "what happened today?"',
			'  "what\'s next?" / "sync my emails"',
			"",
			"Auth: /login  /connect",
		].join("\n"),
	);
}

async function handleLoginCommand(chatId: string) {
	const existing = await getTelegramConnectionByChatId(chatId);
	if (existing) {
		await sendTelegramMessage(
			chatId,
			"This chat is already linked to a Zeromail account. Use /brief for your inbox briefing.",
		);
		return;
	}
	await setLoginState(chatId, { step: "email" });
	await sendTelegramMessage(
		chatId,
		"Enter your email address to log in to Zeromail:",
	);
}

async function handleEmailInput(chatId: string, rawText: string) {
	const email = rawText.trim().toLowerCase();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		await sendTelegramMessage(
			chatId,
			"That doesn't look like a valid email. Please enter your email address:",
		);
		return;
	}

	const otp = generateOtp();
	await setLoginState(chatId, { step: "otp", email, otp, attempts: 0 });

	await sendEmail({
		to: email,
		templateId: "telegramOtp",
		context: { code: otp, expiresInMinutes: 10 },
	});

	await sendTelegramMessage(
		chatId,
		`Code sent to ${email}. Enter the 6-digit code (expires in 10 min):`,
	);
}

async function handleOtpInput(
	chatId: string,
	input: string,
	from: TelegramUser,
) {
	const state = await getLoginState(chatId);
	if (!state || state.step !== "otp") {
		await sendTelegramMessage(
			chatId,
			"Session expired. Use /login to start again.",
		);
		return;
	}

	const code = input.trim().replace(/\s/g, "");
	if (code !== state.otp) {
		const attempts = state.attempts + 1;
		if (attempts >= MAX_OTP_ATTEMPTS) {
			await clearLoginState(chatId);
			await sendTelegramMessage(
				chatId,
				"Too many incorrect attempts. Use /login to request a new code.",
			);
			return;
		}
		await setLoginState(chatId, { ...state, attempts });
		const remaining = MAX_OTP_ATTEMPTS - attempts;
		await sendTelegramMessage(
			chatId,
			`Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`,
		);
		return;
	}

	const consumed = await consumeLoginState(chatId, state);
	if (!consumed) {
		// Another concurrent submission already consumed this code (or a new
		// login was started), so this request must not also succeed.
		await sendTelegramMessage(
			chatId,
			"This code was already used or a new one was requested. Use /login to start again.",
		);
		return;
	}

	let user = await db.user.findUnique({ where: { email: state.email } });
	if (!user) {
		user = await db.user.create({
			data: {
				email: state.email,
				name: state.email.split("@")[0],
				emailVerified: true,
				createdAt: new Date(),
				updatedAt: new Date(),
			},
		});
	}

	await upsertTelegramConnection({
		userId: user.id,
		telegramUserId: String(from.id),
		chatId,
		username: from.username ?? null,
		firstName: from.first_name ?? null,
		lastName: from.last_name ?? null,
		languageCode: from.language_code ?? null,
	});

	await sendTelegramMessage(
		chatId,
		[
			`Linked to ${state.email}.`,
			"",
			"Commands:",
			"/brief - send an inbox briefing now",
			"/settings - show digest settings",
			"/pause - pause daily briefings",
		].join("\n"),
	);
}

async function sendSyncEmails(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	if (mailboxes.length === 0) {
		await sendTelegramMessage(
			chatId,
			"No mailbox connected. Connect Gmail or Outlook in Zeromail first.",
		);
		return;
	}

	await sendTelegramMessage(
		chatId,
		`Syncing ${mailboxes.length} mailbox${mailboxes.length === 1 ? "" : "es"} — this may take a minute...`,
	);

	for (const mailbox of mailboxes) {
		try {
			// Reset the completion flag so syncAllEmails actually runs
			await updateMailboxSyncState(mailbox.id, {
				emailSyncComplete: false,
				emailSyncCursor: null,
			});
			await syncAllEmails({
				id: mailbox.id,
				accountId: mailbox.accountId,
				email: mailbox.email,
			});
			const count = await db.email.count({
				where: { mailboxId: mailbox.id },
			});
			await sendTelegramMessage(
				chatId,
				`Sync complete for ${mailbox.email} — ${count} email${count === 1 ? "" : "s"} in DB. Try /brief or /day now.`,
			);
		} catch (error) {
			logger.error("[telegram] Email sync failed", {
				mailboxId: mailbox.id,
				error: error instanceof Error ? error.message : String(error),
			});
			await sendTelegramMessage(
				chatId,
				`Sync failed for ${mailbox.email}. Check your Gmail connection in Zeromail.`,
			);
		}
	}
}

async function sendDaySummary(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	const now = new Date();
	const mailboxes = connection.user.mailbox as MailboxForDigest[];

	if (mailboxes.length === 0) {
		await sendTelegramMessage(
			chatId,
			"No mailbox connected. Connect Gmail or Outlook in Zeromail first.",
		);
		return;
	}

	for (const mailbox of mailboxes) {
		const { start, end } = getTodayBounds(connection.timezone, now);
		const emails = await db.email.findMany({
			where: {
				mailboxId: mailbox.id,
				internalDate: { gte: start, lte: end },
			},
			orderBy: { internalDate: "desc" },
			take: 50,
			select: {
				id: true,
				threadId: true,
				mailboxId: true,
				from: true,
				fromEmail: true,
				subject: true,
				snippet: true,
				bodyText: true,
				internalDate: true,
			},
		});

		const local = getLocalParts(now, connection.timezone);

		if (emails.length === 0) {
			await sendTelegramMessage(
				chatId,
				`No emails found today for ${mailbox.email}.`,
			);
			continue;
		}

		const classified = await classifyEmails(emails);
		const counts = countCategories(classified);

		const handleNow = classified
			.filter((e) => e.category === "HANDLE_NOW")
			.slice(0, 5);
		const checkToday = classified
			.filter((e) => e.category === "CHECK_TODAY")
			.slice(0, 5);

		const lines: string[] = [
			`Today's summary — ${local.dateKey} — ${mailbox.email}`,
			"",
			`${emails.length} email${emails.length === 1 ? "" : "s"} received`,
			"",
		];

		if (handleNow.length > 0) {
			lines.push(`Handle Now (${counts.HANDLE_NOW}):`);
			for (const e of handleNow) {
				lines.push(
					`• ${compactSubject(e.subject)} — ${compactLine(e.fromEmail, 40)}`,
				);
			}
			lines.push("");
		}

		if (checkToday.length > 0) {
			lines.push(`Check Today (${counts.CHECK_TODAY}):`);
			for (const e of checkToday) {
				lines.push(
					`• ${compactSubject(e.subject)} — ${compactLine(e.fromEmail, 40)}`,
				);
			}
			lines.push("");
		}

		lines.push(`FYI: ${counts.FYI}`);

		await sendTelegramMessage(
			chatId,
			lines
				.filter((l, i) => !(l === "" && lines[i - 1] === ""))
				.join("\n"),
		);
	}
}

async function sendWhatNext(chatId: string) {
	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection) {
		await sendConnectInstructions(chatId);
		return;
	}

	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	const googleMailboxes = mailboxes.filter((m) => m.provider === "GOOGLE");

	if (googleMailboxes.length === 0) {
		await sendTelegramMessage(
			chatId,
			"Calendar events require a connected Google account.",
		);
		return;
	}

	const now = new Date();
	const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

	for (const mailbox of googleMailboxes) {
		try {
			const events = await listUpcomingEvents(mailbox.accountId, {
				timeMin: now.toISOString(),
				timeMax,
				maxResults: 10,
			});

			if (events.length === 0) {
				await sendTelegramMessage(
					chatId,
					`No upcoming events in the next 24 hours for ${mailbox.email}.`,
				);
				continue;
			}

			const lines = [`Upcoming events — ${mailbox.email}`, ""];
			for (const event of events) {
				const title = event.summary ?? "(No title)";
				if (event.isAllDay) {
					lines.push(`📅 ${title} — All day`);
				} else if (event.start) {
					const time = formatEventTime(
						event.start,
						connection.timezone,
					);
					const rel = formatRelativeTime(event.start, now);
					lines.push(`📅 ${title} — ${time} (${rel})`);
				} else {
					lines.push(`📅 ${title}`);
				}
				if (event.location) {
					lines.push(`   ${compactLine(event.location, 80)}`);
				}
			}

			await sendTelegramMessage(chatId, lines.join("\n"));
		} catch (error) {
			logger.error("[telegram] Calendar fetch failed", {
				mailboxId: mailbox.id,
				error: error instanceof Error ? error.message : String(error),
			});
			await sendTelegramMessage(
				chatId,
				`Could not fetch calendar events for ${mailbox.email}. Make sure your Google account has calendar access.`,
			);
		}
	}
}

async function sendBriefingForConnection(
	connection: Awaited<
		ReturnType<typeof getTelegramConnectionByChatId>
	> extends infer T
		? NonNullable<T>
		: never,
	options: { manual: boolean; now: Date },
) {
	const mailboxes = connection.user.mailbox as MailboxForDigest[];
	if (mailboxes.length === 0) {
		await sendTelegramMessage(
			connection.chatId,
			"No mailbox is connected yet. Connect Gmail or Outlook in Zeromail first.",
		);
		return;
	}

	for (const mailbox of mailboxes) {
		const emails = await getRecentInboxEmails(mailbox, 20);
		if (emails.length === 0) {
			await sendTelegramMessage(
				connection.chatId,
				`No unread inbox messages for ${mailbox.email}.`,
			);
			continue;
		}

		const classified = await classifyEmails(emails);
		const counts = countCategories(classified);

		await recordTelegramBriefing({
			userId: connection.userId,
			mailboxId: mailbox.id,
			briefingDate: localDateAsUtcMidnight(
				options.now,
				connection.timezone,
			),
			categoryCounts: counts,
			messageIds: classified.map((email) => email.id),
		});

		await sendTelegramMessage(
			connection.chatId,
			formatBriefingSummary(mailbox.email, counts, classified),
		);

		const actionable = classified
			.filter((email) => email.category !== "FYI")
			.slice(0, 8);

		for (const email of actionable) {
			await sendClassifiedEmail(
				connection.chatId,
				connection.userId,
				email,
			);
		}
	}
}

async function getRecentInboxEmails(
	mailbox: MailboxForDigest,
	limit: number,
): Promise<DigestEmail[]> {
	return db.email.findMany({
		where: {
			mailboxId: mailbox.id,
			labelIds: { has: "INBOX" },
			isUnread: true,
		},
		orderBy: { internalDate: "desc" },
		take: limit,
		select: {
			id: true,
			threadId: true,
			mailboxId: true,
			from: true,
			fromEmail: true,
			subject: true,
			snippet: true,
			bodyText: true,
			internalDate: true,
		},
	});
}

function getTodayBounds(
	timezone: string,
	now: Date = new Date(),
): { start: Date; end: Date } {
	const local = getLocalParts(now, timezone);
	const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
	const localMinutes = local.hour * 60 + local.minute;
	let offsetMinutes = localMinutes - utcMinutes;
	if (offsetMinutes > 12 * 60) {
		offsetMinutes -= 24 * 60;
	}
	if (offsetMinutes < -12 * 60) {
		offsetMinutes += 24 * 60;
	}
	const localMidnight = new Date(`${local.dateKey}T00:00:00.000Z`);
	localMidnight.setMinutes(localMidnight.getMinutes() - offsetMinutes);
	return {
		start: localMidnight,
		end: new Date(localMidnight.getTime() + 24 * 60 * 60 * 1000),
	};
}

function formatEventTime(dateStr: string, timezone: string): string {
	return new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).format(new Date(dateStr));
}

function formatRelativeTime(dateStr: string, now: Date): string {
	const diffMin = Math.round(
		(new Date(dateStr).getTime() - now.getTime()) / 60000,
	);
	if (diffMin < 0) {
		return "ongoing";
	}
	if (diffMin < 60) {
		return `in ${diffMin}m`;
	}
	const h = Math.floor(diffMin / 60);
	const m = diffMin % 60;
	return m > 0 ? `in ${h}h ${m}m` : `in ${h}h`;
}

async function classifyEmails(
	emails: DigestEmail[],
): Promise<ClassifiedEmail[]> {
	if (!process.env.SARVAM_API_KEY) {
		return emails.map((email) => ({
			...email,
			...heuristicClassify(email),
		}));
	}

	try {
		const object = await generateWithSarvam({
			schema: CLASSIFICATION_SCHEMA,
			temperature: 0,
			system: [
				"You classify inbox email into exactly one decision bucket.",
				"HANDLE_NOW means the email likely needs a reply, decision, urgent review, security/payment attention, or has a near deadline.",
				"CHECK_TODAY means important but not immediately urgent.",
				"FYI means newsletters, promos, receipts, automated status updates, or informational mail.",
				"Return every email id exactly once. Keep reasons concise and observable.",
				'OUTPUT FORMAT: respond with a single JSON object {"items": [{"id": string, "category": "HANDLE_NOW"|"CHECK_TODAY"|"FYI", "reason": string}, ...]} — no extra text.',
			].join("\n"),
			prompt: JSON.stringify({
				emails: emails.map((email) => ({
					id: email.id,
					from: email.from,
					fromEmail: email.fromEmail,
					subject: email.subject,
					snippet: email.snippet,
					bodyText: email.bodyText.slice(0, 1200),
					date: email.internalDate.toISOString(),
				})),
			}),
		});

		const byId = new Map(object.items.map((item) => [item.id, item]));
		return emails.map((email) => {
			const item = byId.get(email.id);
			if (!item) {
				return {
					...email,
					...heuristicClassify(email),
				};
			}
			return {
				...email,
				category: item.category,
				reason: item.reason,
			};
		});
	} catch (error) {
		logger.warn("[telegram] AI classification failed, using fallback", {
			error: error instanceof Error ? error.message : String(error),
		});
		return emails.map((email) => ({
			...email,
			...heuristicClassify(email),
		}));
	}
}

function heuristicClassify(email: DigestEmail): {
	category: DecisionCategory;
	reason: string;
} {
	const text =
		`${email.from} ${email.fromEmail} ${email.subject} ${email.snippet} ${email.bodyText}`.toLowerCase();

	if (
		/\b(urgent|asap|action required|verify|security alert|failed payment|past due|deadline|due today|invoice overdue|blocked|suspicious)\b/.test(
			text,
		)
	) {
		return {
			category: "HANDLE_NOW",
			reason: "Contains urgent or action-required language.",
		};
	}

	if (
		/\b(meeting|proposal|contract|review|approve|approval|customer|client|interview|calendar|schedule|reply)\b/.test(
			text,
		)
	) {
		return {
			category: "CHECK_TODAY",
			reason: "Looks work-related and worth checking today.",
		};
	}

	return {
		category: "FYI",
		reason: "Looks informational or low urgency.",
	};
}

function countCategories(classified: ClassifiedEmail[]) {
	return {
		HANDLE_NOW: classified.filter(
			(email) => email.category === "HANDLE_NOW",
		).length,
		CHECK_TODAY: classified.filter(
			(email) => email.category === "CHECK_TODAY",
		).length,
		FYI: classified.filter((email) => email.category === "FYI").length,
	};
}

function formatBriefingSummary(
	mailboxEmail: string,
	counts: ReturnType<typeof countCategories>,
	classified: ClassifiedEmail[],
) {
	const topHandleNow = classified
		.filter((email) => email.category === "HANDLE_NOW")
		.slice(0, 3)
		.map(
			(email, index) => `${index + 1}. ${compactSubject(email.subject)}`,
		);

	return [
		`Today's email briefing: ${mailboxEmail}`,
		"",
		`Handle Now: ${counts.HANDLE_NOW}`,
		`Check Today: ${counts.CHECK_TODAY}`,
		`FYI: ${counts.FYI}`,
		"",
		topHandleNow.length
			? ["Top Handle Now:", ...topHandleNow].join("\n")
			: "No Handle Now messages found.",
	].join("\n");
}

async function sendClassifiedEmail(
	chatId: string,
	userId: string,
	email: ClassifiedEmail,
) {
	const replyMarkup = await buildActionKeyboard(userId, email);

	await sendTelegramMessage(
		chatId,
		[
			`[${formatCategory(email.category)}]`,
			`From: ${compactLine(email.from || email.fromEmail, 90)}`,
			`Subject: ${compactSubject(email.subject)}`,
			`Why: ${compactLine(email.reason, 180)}`,
			email.snippet ? `Preview: ${compactLine(email.snippet, 260)}` : "",
		]
			.filter(Boolean)
			.join("\n"),
		{ replyMarkup },
	);
}

async function buildActionKeyboard(
	userId: string,
	email: ClassifiedEmail,
): Promise<InlineKeyboardMarkup> {
	const [markRead, archive, trash] = await Promise.all([
		createTelegramAction({
			userId,
			mailboxId: email.mailboxId,
			messageId: email.id,
			action: "MARK_READ",
		}),
		createTelegramAction({
			userId,
			mailboxId: email.mailboxId,
			messageId: email.id,
			action: "ARCHIVE",
		}),
		createTelegramAction({
			userId,
			mailboxId: email.mailboxId,
			messageId: email.id,
			action: "TRASH",
		}),
	]);

	return {
		inline_keyboard: [
			[
				{
					text: "Mark read",
					callback_data: `${ACTION_CALLBACK_PREFIX}${markRead.id}`,
				},
				{
					text: "Archive",
					callback_data: `${ACTION_CALLBACK_PREFIX}${archive.id}`,
				},
				{
					text: "Trash",
					callback_data: `${ACTION_CALLBACK_PREFIX}${trash.id}`,
				},
			],
			[
				{
					text: "Open Zeromail",
					url: `${getBaseUrl()}/app/mailboxes?folder=inbox`,
				},
			],
		],
	};
}

async function handleTelegramCallback(callback: TelegramCallbackQuery) {
	const data = callback.data ?? "";
	if (!data.startsWith(ACTION_CALLBACK_PREFIX)) {
		await answerTelegramCallbackQuery(callback.id);
		return;
	}

	const chatId = callback.message?.chat.id
		? String(callback.message.chat.id)
		: undefined;
	if (!chatId) {
		await answerTelegramCallbackQuery(callback.id, "Unsupported action.");
		return;
	}

	const connection = await getTelegramConnectionByChatId(chatId);
	if (!connection || connection.telegramUserId !== String(callback.from.id)) {
		await answerTelegramCallbackQuery(
			callback.id,
			"This chat is not linked.",
		);
		return;
	}

	const actionId = data.slice(ACTION_CALLBACK_PREFIX.length);
	const action = await claimTelegramAction(actionId);
	if (!action) {
		await answerTelegramCallbackQuery(
			callback.id,
			"Action expired or already used.",
		);
		return;
	}

	if (action.userId !== connection.userId) {
		await answerTelegramCallbackQuery(
			callback.id,
			"Action does not belong to this account.",
		);
		return;
	}

	try {
		await runMailboxAction(action);
		await answerTelegramCallbackQuery(
			callback.id,
			`${formatAction(action.action)} done.`,
		);

		if (callback.message?.message_id) {
			await editTelegramMessageReplyMarkup({
				chatId,
				messageId: callback.message.message_id,
			}).catch(() => undefined);
		}
	} catch (error) {
		logger.error("[telegram] Callback action failed", {
			actionId: action.id,
			action: action.action,
			error: error instanceof Error ? error.message : String(error),
		});
		await answerTelegramCallbackQuery(
			callback.id,
			"Action failed. Please try in Zeromail.",
		);
	}
}

async function runMailboxAction(
	action: NonNullable<Awaited<ReturnType<typeof claimTelegramAction>>>,
) {
	const mailbox = action.mailbox;
	if (mailbox.provider === "OUTLOOK") {
		await runOutlookAction(
			mailbox.accountId,
			action.messageId,
			action.action,
		);
		return;
	}

	await runGmailAction(mailbox.accountId, action.messageId, action.action);
}

async function runGmailAction(
	accountId: string,
	messageId: string,
	action: "ARCHIVE" | "MARK_READ" | "TRASH",
) {
	if (action === "TRASH") {
		await trashGmailMessage(accountId, messageId);
		await updateLocalLabelsAfterAction(messageId, {
			remove: ["INBOX"],
			add: ["TRASH"],
		});
		return;
	}

	if (action === "ARCHIVE") {
		await modifyMessageLabels(accountId, messageId, [], ["INBOX"]);
		await updateLocalLabelsAfterAction(messageId, { remove: ["INBOX"] });
		return;
	}

	await modifyMessageLabels(accountId, messageId, [], ["UNREAD"]);
	await updateLocalLabelsAfterAction(messageId, { remove: ["UNREAD"] });
}

async function runOutlookAction(
	accountId: string,
	messageId: string,
	action: "ARCHIVE" | "MARK_READ" | "TRASH",
) {
	if (action === "MARK_READ") {
		await updateOutlookMessage(accountId, messageId, { isRead: true });
		await updateLocalLabelsAfterAction(messageId, { remove: ["UNREAD"] });
		return;
	}

	if (action === "ARCHIVE") {
		await moveOutlookMessage(accountId, messageId, "archive");
		await updateLocalLabelsAfterAction(messageId, { remove: ["INBOX"] });
		return;
	}

	await moveOutlookMessage(accountId, messageId, "deleteditems");
	await updateLocalLabelsAfterAction(messageId, {
		remove: ["INBOX"],
		add: ["TRASH"],
	});
}

async function updateLocalLabelsAfterAction(
	messageId: string,
	patch: { add?: string[]; remove?: string[] },
) {
	const email = await db.email.findUnique({ where: { id: messageId } });
	if (!email) {
		return;
	}

	const remove = new Set(patch.remove ?? []);
	const next = new Set(email.labelIds.filter((label) => !remove.has(label)));
	for (const label of patch.add ?? []) {
		next.add(label);
	}

	await updateEmailLabels(messageId, [...next]);
}

function isDigestDue(
	connection: {
		timezone: string;
		dailyDigestTime: string;
		lastBriefingSentAt: Date | null;
	},
	now: Date,
) {
	const timezone = connection.timezone || DEFAULT_TIME_ZONE;
	const localNow = getLocalParts(now, timezone);
	const [hourRaw, minuteRaw] = (
		connection.dailyDigestTime || DEFAULT_DIGEST_TIME
	)
		.split(":")
		.map((part) => Number(part));
	const targetHour = Number.isFinite(hourRaw) ? hourRaw : 9;
	const targetMinute = Number.isFinite(minuteRaw) ? minuteRaw : 0;
	const targetMinutes = targetHour * 60 + targetMinute;
	const currentMinutes = localNow.hour * 60 + localNow.minute;

	if (
		currentMinutes < targetMinutes ||
		currentMinutes >= targetMinutes + 75
	) {
		return false;
	}

	if (!connection.lastBriefingSentAt) {
		return true;
	}

	const lastSent = getLocalParts(connection.lastBriefingSentAt, timezone);
	return lastSent.dateKey !== localNow.dateKey;
}

function localDateAsUtcMidnight(now: Date, timezone: string) {
	const parts = getLocalParts(now, timezone || DEFAULT_TIME_ZONE);
	return new Date(`${parts.dateKey}T00:00:00.000Z`);
}

function getLocalParts(date: Date, timezone: string) {
	try {
		const parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
		}).formatToParts(date);
		const get = (type: string) =>
			parts.find((part) => part.type === type)?.value ?? "00";
		return {
			dateKey: `${get("year")}-${get("month")}-${get("day")}`,
			hour: Number(get("hour")) % 24,
			minute: Number(get("minute")),
		};
	} catch {
		return getLocalParts(date, "UTC");
	}
}

function buildStartLink(startParam: string) {
	const username = (
		process.env.TELEGRAM_BOT_USERNAME || "mailmonkey_bot"
	).replace(/^@/, "");
	return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
}

function formatCategory(category: DecisionCategory) {
	if (category === "HANDLE_NOW") {
		return "Handle Now";
	}
	if (category === "CHECK_TODAY") {
		return "Check Today";
	}
	return "FYI";
}

function formatAction(action: string) {
	if (action === "MARK_READ") {
		return "Mark read";
	}
	if (action === "ARCHIVE") {
		return "Archive";
	}
	return "Trash";
}

function compactSubject(subject: string) {
	return compactLine(subject || "(No subject)", 120);
}

function compactLine(value: string, maxLength: number) {
	const clean = value.replace(/\s+/g, " ").trim();
	if (clean.length <= maxLength) {
		return clean;
	}
	return `${clean.slice(0, maxLength - 3)}...`;
}
