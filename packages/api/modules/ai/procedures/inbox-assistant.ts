import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ORPCError, streamToEventIterator } from "@orpc/client";
import {
	convertToModelMessages,
	stepCountIs,
	streamText,
	TEXT_MODEL_ID,
	tool,
	type UIMessage,
} from "@repo/ai";
import {
	appendMessages,
	cancelReminder,
	cancelScheduledEmail,
	cancelSnoozedEmail,
	createReminder,
	createScheduledEmail,
	createSnoozedEmail,
	deleteEmail,
	findUnansweredThreads,
	getActiveReminders,
	getActiveSnoozedEmails,
	getConversation,
	getDashboardSummary,
	getEmailById,
	getEmailsByMailbox,
	getMailboxStats,
	getMailboxSyncState,
	getPendingScheduledEmails,
	getRulesByMailboxId,
	markEmailRead,
	markEmailUnread,
	updateEmailLabels,
} from "@repo/database";
import { canUseAiChat } from "@repo/payments/lib/plan-limits";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import {
	createCalDavEvent,
	getCalDavEventsResult,
} from "../../mailboxes/lib/caldav-client";
import {
	classifyCalendarError,
	createCalendarEvent,
	createGoogleMeet,
	getCalendarResult,
} from "../../mailboxes/lib/calendar-client";
import { buildAiInsightSentence } from "../../mailboxes/lib/dashboard-insight";
import { encodeRfc2822 } from "../../mailboxes/lib/email-encoder";
import { sendEmailForMailbox } from "../../mailboxes/lib/email-sender";
import { syncRecentEmails } from "../../mailboxes/lib/email-sync";
import {
	createDraft,
	deleteMessage as gmailDeleteMessage,
	sendDraft as gmailSendDraft,
	modifyMessageLabels,
	updateDraft,
} from "../../mailboxes/lib/gmail-client";
import { saveImapDraft, sendImapDraft } from "../../mailboxes/lib/imap-drafts";
import {
	deleteImapMessage,
	listImapLabelFolders,
} from "../../mailboxes/lib/imap-provider";
import { syncRecentImapEmails } from "../../mailboxes/lib/imap-sync";
import { resolveLabelNameToId } from "../../mailboxes/lib/label-resolver";
import { getMailProvider } from "../../mailboxes/lib/mail-provider";
import { verifyMailboxOwnership } from "../../mailboxes/lib/ownership";
import { getUserLabelsWithCounts } from "../../mailboxes/lib/user-labels";
import {
	classifyZoomError,
	createZoomMeeting,
} from "../../mailboxes/lib/zoom-client";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import {
	applyLabelToEmailInput,
	archiveEmailInput,
	buildSystemPrompt,
	cancelReminderInput,
	cancelScheduledEmailInput,
	cancelSnoozeInput,
	citeEmailsInput,
	createCalendarEventInput,
	createMeetingInput,
	createReminderInput,
	deleteEmailInput,
	findUnansweredInput,
	getCalendarInput,
	markEmailReadInput,
	markEmailUnreadInput,
	readEmailInput,
	saveDraftInput,
	scheduleEmailInput,
	searchEmailsInput,
	sendEmailInput,
	sendSavedDraftInput,
	snoozeEmailInput,
	trashEmailInput,
} from "./inbox-assistant.prompt";

/** Trim an email row to the fields the model needs — never ships bodies. */
function toEmailSummary(e: {
	id: string;
	threadId: string;
	from: string;
	fromEmail: string;
	to: string;
	subject: string;
	snippet: string;
	isUnread: boolean;
	internalDate: Date;
}) {
	return {
		id: e.id,
		threadId: e.threadId,
		from: e.from,
		fromEmail: e.fromEmail,
		to: e.to,
		subject: e.subject,
		snippet: e.snippet,
		isUnread: e.isUnread,
		date: e.internalDate.toISOString(),
	};
}

export const inboxAssistant = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/ai/inbox-assistant",
		tags: ["AI"],
		summary: "Inbox assistant",
		description:
			"Stream an answer about the user's own emails, rules and calendar",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			conversationId: z.string(),
			messages: z.array(z.any() as z.ZodType<UIMessage>),
			// IANA timezone from the browser (e.g. "Asia/Kolkata"), used to
			// resolve "today"/"tomorrow" in the user's local day rather than
			// the server's — otherwise relative dates can land on the wrong
			// calendar day near midnight when the two differ.
			timeZone: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const { mailboxId, conversationId, messages, timeZone } = input;

		// The assistant spends AI quota, so enforce the plan here and not only in
		// the UI — a direct API call must not bypass the paywall.
		const planId = await resolveUserPlan(context.user.id);
		if (!canUseAiChat(planId)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"The inbox assistant needs an active plan or free trial. Start your trial or upgrade to use it.",
			});
		}

		const mailbox = await verifyMailboxOwnership(
			mailboxId,
			context.user.id,
		);

		// The conversation must exist and belong to this user (also pins it to
		// the mailbox we're about to read from).
		const conversation = await getConversation({
			id: conversationId,
			userId: context.user.id,
		});
		if (!conversation || conversation.mailboxId !== mailboxId) {
			throw new ORPCError("NOT_FOUND", {
				message: "Conversation not found.",
			});
		}

		// Refresh the local mirror before answering. The assistant reads a local
		// copy of the mailbox, not live Gmail; that copy only advances on inbox
		// refresh or a push webhook, so it can lag days behind (e.g. a missed
		// watch renewal). Without this, a question like "what did X email me this
		// week?" is answered against stale data and wrongly reports "no emails".
		// Gmail-only (mirrors sync-emails.ts); best-effort so a token/quota error
		// degrades to answering from the existing mirror rather than failing.
		if (mailbox.provider === "GOOGLE") {
			try {
				await syncRecentEmails(
					{
						id: mailbox.id,
						accountId: mailbox.accountId,
						email: mailbox.email,
					},
					50,
				);
			} catch (err) {
				console.warn(
					"[inbox-assistant] recent-sync before answering failed; using existing mirror",
					err,
				);
			}
		}

		// Same refresh for custom (IMAP) mailboxes: pull the newest mail of every
		// mirrored folder so answers aren't based on a copy that is up to 5 minutes
		// stale. Bounded, so a slow mail server can't stall the answer.
		if (mailbox.provider === "IMAP") {
			try {
				await Promise.race([
					syncRecentImapEmails(
						{
							id: mailbox.id,
							accountId: mailbox.accountId,
							email: mailbox.email,
						},
						50,
						{ onlyNew: true },
					),
					new Promise((_, reject) =>
						setTimeout(
							() => reject(new Error("IMAP refresh timed out")),
							10_000,
						),
					),
				]);
			} catch (err) {
				console.warn(
					"[inbox-assistant] IMAP refresh before answering failed; using existing mirror",
					err,
				);
			}
		}

		const google = createGoogleGenerativeAI({
			apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
		});

		const response = streamText({
			model: google(TEXT_MODEL_ID),
			system: buildSystemPrompt(new Date(), timeZone),
			messages: await convertToModelMessages(
				messages as unknown as UIMessage[],
			),
			// Allow a few tool round-trips (search → read → answer → cite) before
			// forcing a final text answer.
			stopWhen: stepCountIs(6),
			tools: {
				// ── Read-only data tools (server-executed) ──────────────────
				searchEmails: tool({
					description:
						"Search or list the user's emails. Returns lightweight summaries (no bodies); use readEmail for full content. Each summary's id is what you pass to citeEmails.",
					inputSchema: searchEmailsInput,
					execute: async ({
						query,
						folder,
						label,
						unreadOnly,
						since,
						until,
						limit,
					}) => {
						const parseDate = (v?: string) => {
							if (!v) {
								return undefined;
							}
							const d = new Date(v);
							return Number.isNaN(d.getTime()) ? undefined : d;
						};
						// Emails store Gmail's opaque label ID (e.g. "Label_21"),
						// not the display name, so a filter on the name alone never
						// matches. Resolve name → ID and pass both. Also default to
						// searching ALL mail when a label is given without an
						// explicit folder — labelled mail is often archived out of
						// the inbox, so an inbox-only scope would miss it.
						let labelId: string | undefined;
						if (label && mailbox.provider === "GOOGLE") {
							labelId = await resolveLabelNameToId(
								mailbox.accountId,
								label,
							);
						}
						const emails = await getEmailsByMailbox(mailboxId, {
							folder: folder ?? (label ? "all" : "inbox"),
							search: query,
							label,
							labelId,
							since: parseDate(since),
							until: parseDate(until),
							limit: limit ?? 25,
						});
						const filtered = unreadOnly
							? emails.filter((e) => e.isUnread)
							: emails;
						// Tell the model when the local mirror may be incomplete, so
						// an empty result for an older window isn't reported as a
						// definitive "you have no mail".
						const sync = await getMailboxSyncState(mailboxId);
						return {
							emails: filtered.map(toEmailSummary),
							syncComplete: sync?.emailSyncComplete ?? false,
							note:
								filtered.length === 0 &&
								!sync?.emailSyncComplete
									? "No matching emails in the local copy, which is still importing older mail. Tell the user their inbox is still syncing rather than that they have no emails."
									: undefined,
						};
					},
				}),
				findUnansweredThreads: tool({
					description:
						"Find recent inbox threads the user has NOT replied to (inbox emails whose thread has no message in Sent). Use for 'who am I owing a reply', 'clients waiting on me', 'unanswered emails'. Pass a search term to scope to a client/sender/domain.",
					inputSchema: findUnansweredInput,
					execute: async ({ search, limit }) => {
						const threads = await findUnansweredThreads(mailboxId, {
							search,
							limit: limit ?? 15,
						});
						return { unanswered: threads.map(toEmailSummary) };
					},
				}),
				readEmail: tool({
					description:
						"Read the full sender, subject and body of a single email by id.",
					inputSchema: readEmailInput,
					execute: async ({ emailId }) => {
						const email = await getEmailById(mailboxId, emailId);
						if (!email) {
							return { found: false as const };
						}
						return {
							found: true as const,
							id: email.id,
							from: email.from,
							fromEmail: email.fromEmail,
							subject: email.subject,
							date: email.internalDate.toISOString(),
							// Cap body to keep the context small.
							body: (email.bodyText ?? "").slice(0, 2000),
						};
					},
				}),
				listActiveRules: tool({
					description:
						"List the user's email rules (name, whether enabled, conditions and actions).",
					inputSchema: z.object({}),
					execute: async () => {
						const rules = await getRulesByMailboxId({ mailboxId });
						return {
							rules: rules.map((r) => ({
								name: r.name,
								enabled: r.enabled,
								condition: r.condition,
								actions: r.actions,
							})),
						};
					},
				}),
				getDashboardSummary: tool({
					description:
						"Get the live numbers shown on the user's Dashboard for the selected mailbox: inbox-zero percent (share of inbox that's read), priority/important count, the inbox category breakdown (Primary, Newsletter, Promotion, Social) with per-category counts, how many inbox emails are not yet categorized, the top senders with their email counts, and a one-line AI insight about the last 24h. Use this whenever the user asks about their dashboard, inbox overview, category breakdown, top senders, how many unread/priority they have, or 'how am I doing on my inbox' — answer with the ACTUAL numbers, not a generic description.",
					inputSchema: z.object({}),
					execute: async () => {
						const [summary, stats] = await Promise.all([
							getDashboardSummary(mailboxId),
							getMailboxStats(mailboxId),
						]);
						return {
							inboxZeroPercent: summary.inboxZeroPercent,
							priorityCount: summary.priorityCount,
							categoryBreakdown: summary.categoryBreakdown,
							categorizedTotal: summary.categorizedTotal,
							uncategorizedCount: summary.uncategorizedCount,
							topSenders: summary.topSenders,
							aiInsight: buildAiInsightSentence(
								stats.actionsBreakdown24h,
							),
						};
					},
				}),
				listLabels: tool({
					description:
						"List the user's labels (a.k.a. 'levels'/'folders') with how many emails each holds. Use to answer 'what labels do I have', 'how many emails are in the X label', or to check whether a label exists before searching it. If a label the user names is NOT in this list, tell them it doesn't exist rather than guessing. To then list the actual emails in a label, call searchEmails with that label.",
					inputSchema: z.object({}),
					execute: async () => {
						const labels = await getUserLabelsWithCounts(mailbox);
						if (mailbox.provider === "IMAP") {
							// The account's own folders are its labels on IMAP.
							try {
								const known = new Set(
									labels.map((l) => l.name.toLowerCase()),
								);
								for (const {
									name,
									unread,
								} of await listImapLabelFolders(
									mailbox.accountId,
								)) {
									if (!known.has(name.toLowerCase())) {
										labels.push({ name, count: unread });
									}
								}
							} catch (err) {
								console.warn(
									"[inbox-assistant] listing IMAP folders failed",
									err,
								);
							}
						}
						return { labels };
					},
				}),
				listScheduledEmails: tool({
					description:
						"List the user's scheduled (send-later) emails that are still pending — the 'Scheduled' section. Use for 'what have I scheduled', 'what's queued to send', 'do I have any send-later emails'.",
					inputSchema: z.object({}),
					execute: async () => {
						const scheduled =
							await getPendingScheduledEmails(mailboxId);
						return {
							scheduled: scheduled.map((s) => ({
								id: s.id,
								to: s.to,
								subject: s.subject,
								scheduledAt: s.scheduledAt.toISOString(),
								status: s.status,
							})),
						};
					},
				}),
				listSnoozedEmails: tool({
					description:
						"List the user's currently snoozed emails — the 'Snoozed' section (emails hidden until a wake time). Use for 'what's snoozed', 'what did I snooze', 'what emails come back later'.",
					inputSchema: z.object({}),
					execute: async () => {
						const snoozed = await getActiveSnoozedEmails(mailboxId);
						return {
							snoozed: snoozed.map((s) => ({
								id: s.id,
								from: s.from,
								subject: s.subject,
								snippet: s.snippet,
								snoozeUntil: s.snoozeUntil.toISOString(),
								date: s.internalDate.toISOString(),
							})),
						};
					},
				}),
				getCalendar: tool({
					description:
						"List the user's upcoming calendar events in a time window. An empty events list means the user genuinely has nothing scheduled then — say so plainly; do NOT call that an error or say the calendar is unavailable.",
					inputSchema: getCalendarInput,
					execute: async ({ timeMin, timeMax }) => {
						// Reuses the app's own classified fetch (with a retry on a
						// transient blip) so we can tell the user the right thing
						// instead of a blanket "unavailable".
						if (mailbox.provider === "IMAP") {
							const caldav = await getCalDavEventsResult(
								mailbox.accountId,
								{
									timeMin,
									timeMax,
								},
							);
							if (caldav.status === "ok") {
								return { events: caldav.events };
							}
							return {
								error: "transient" as const,
								message: `Couldn't load the calendar from the user's mail provider: ${caldav.message} Tell the user this plainly; do not say they have no events.`,
							};
						}
						const result = await getCalendarResult(
							mailbox.accountId,
							{ timeMin, timeMax },
						);
						switch (result.status) {
							case "ok":
								return { events: result.events };
							case "needsReconnect":
								return {
									error: "needsReconnect" as const,
									message:
										"Calendar access isn't granted for this account. Tell the user to reconnect their Google account (Settings) to enable calendar — do not say the service is down.",
								};
							case "serviceDisabled":
								return {
									error: "serviceDisabled" as const,
									message:
										"The Google Calendar API is disabled for this app. Tell the user calendar is temporarily disabled for the app, not that they have no events.",
								};
							default:
								return {
									error: "transient" as const,
									message:
										"Couldn't reach the calendar just now after a retry. Tell the user to try again in a moment.",
								};
						}
					},
				}),
				// ── Action tools (write) ────────────────────────────────────
				// Reversible actions execute immediately. Risky/irreversible
				// ones set needsApproval: true — the SDK pauses the stream,
				// the client renders a confirm/cancel card, and execute only
				// runs once the user approves.
				archiveEmail: tool({
					description:
						"Archive an email (remove it from the inbox). Reversible — runs immediately, no confirmation needed.",
					inputSchema: archiveEmailInput,
					execute: async ({ emailId }) => {
						await getMailProvider(mailbox.provider).archive(
							mailbox.accountId,
							emailId,
						);
						const localEmail = await getEmailById(
							mailboxId,
							emailId,
						);
						if (localEmail) {
							await updateEmailLabels(
								emailId,
								localEmail.labelIds.filter(
									(l) => l !== "INBOX",
								),
							);
						}
						return { success: true };
					},
				}),
				snoozeEmail: tool({
					description:
						"Snooze an email until a chosen time (hides it until then). Reversible — runs immediately, no confirmation needed.",
					inputSchema: snoozeEmailInput,
					execute: async ({ emailId, snoozeUntil }) => {
						const wakeAt = new Date(snoozeUntil);
						if (wakeAt.getTime() <= Date.now() - 60_000) {
							return {
								success: false as const,
								error: "Snooze time must be in the future.",
							};
						}
						if (mailbox.provider !== "IMAP") {
							await modifyMessageLabels(
								mailbox.accountId,
								emailId,
								[],
								["INBOX"],
							);
						}
						let from = "";
						let subject = "(No subject)";
						let snippet = "";
						let internalDate = new Date();
						let isUnread = true;
						let threadId: string | null = null;
						let originalLabelIds: string[] = ["INBOX"];
						const localEmail = await getEmailById(
							mailboxId,
							emailId,
						);
						if (localEmail) {
							from = localEmail.from;
							subject = localEmail.subject || "(No subject)";
							snippet = localEmail.snippet;
							internalDate = localEmail.internalDate;
							isUnread = localEmail.isUnread;
							threadId = localEmail.threadId;
							originalLabelIds = localEmail.labelIds;
							await updateEmailLabels(
								emailId,
								localEmail.labelIds.filter(
									(l) => l !== "INBOX",
								),
							);
						}
						const snoozed = await createSnoozedEmail({
							mailboxId,
							messageId: emailId,
							threadId,
							from,
							subject,
							snippet,
							internalDate,
							isUnread,
							originalLabelIds,
							snoozeUntil: wakeAt,
						});
						return {
							success: true as const,
							id: snoozed.id,
							snoozeUntil: snoozed.snoozeUntil.toISOString(),
						};
					},
				}),
				markEmailRead: tool({
					description:
						"Mark an email as read. Reversible — runs immediately, no confirmation needed.",
					inputSchema: markEmailReadInput,
					execute: async ({ emailId }) => {
						await getMailProvider(mailbox.provider).markRead(
							mailbox.accountId,
							emailId,
						);
						await markEmailRead(emailId);
						return { success: true };
					},
				}),
				markEmailUnread: tool({
					description:
						"Mark an email as unread. Reversible — runs immediately, no confirmation needed.",
					inputSchema: markEmailUnreadInput,
					execute: async ({ emailId }) => {
						await getMailProvider(mailbox.provider).markUnread(
							mailbox.accountId,
							emailId,
						);
						await markEmailUnread(emailId);
						return { success: true };
					},
				}),
				applyLabelToEmail: tool({
					description:
						"Apply a label to an email (creates the label if it doesn't exist). This is how you 'move' an email to a named category like 'Finance' — Gmail has no real folders outside labels. Reversible — runs immediately, no confirmation needed.",
					inputSchema: applyLabelToEmailInput,
					execute: async ({ emailId, label }) => {
						await getMailProvider(mailbox.provider).applyLabel(
							mailbox.accountId,
							emailId,
							label,
						);
						const localEmail = await getEmailById(
							mailboxId,
							emailId,
						);
						if (localEmail) {
							// Gmail rows store the opaque label id; Outlook/IMAP store the name.
							const labelId =
								mailbox.provider === "GOOGLE"
									? await resolveLabelNameToId(
											mailbox.accountId,
											label,
										)
									: label;
							if (
								labelId &&
								!localEmail.labelIds.includes(labelId)
							) {
								await updateEmailLabels(emailId, [
									...localEmail.labelIds,
									labelId,
								]);
							}
						}
						return { success: true };
					},
				}),
				saveDraft: tool({
					description:
						"Create a new draft, or update an existing one if draftId is given. Reversible — runs immediately, no confirmation needed.",
					inputSchema: saveDraftInput,
					execute: async ({
						draftId,
						to,
						cc,
						bcc,
						subject,
						body,
					}) => {
						if (mailbox.provider === "IMAP") {
							const saved = await saveImapDraft(
								mailbox.accountId,
								{
									from: mailbox.email,
									to,
									cc,
									bcc,
									subject,
									body,
								},
								draftId,
							);
							return {
								draftId: saved.draftId,
								messageId: saved.draftId,
							};
						}
						const raw = encodeRfc2822({
							from: mailbox.email,
							to,
							cc,
							bcc,
							subject,
							body,
						});
						const draft = draftId
							? await updateDraft(mailbox.accountId, draftId, raw)
							: await createDraft(mailbox.accountId, raw);
						return {
							draftId: draft.id ?? draftId ?? null,
							messageId: draft.message?.id ?? null,
						};
					},
				}),
				cancelScheduledEmail: tool({
					description:
						"Cancel a pending scheduled (send-later) email. Reversible — runs immediately, no confirmation needed.",
					inputSchema: cancelScheduledEmailInput,
					execute: async ({ scheduledEmailId }) => {
						const count = await cancelScheduledEmail(
							scheduledEmailId,
							mailboxId,
						);
						if (count === 0) {
							return {
								success: false as const,
								error: "This scheduled email no longer exists or has already been sent.",
							};
						}
						return { success: true as const };
					},
				}),
				cancelSnooze: tool({
					description:
						"Cancel a snooze and return the email to the inbox now. Reversible — runs immediately, no confirmation needed.",
					inputSchema: cancelSnoozeInput,
					execute: async ({ snoozedEmailId }) => {
						const snoozed = await getActiveSnoozedEmails(
							mailboxId,
						).then((list) =>
							list.find((s) => s.id === snoozedEmailId),
						);
						if (!snoozed) {
							return {
								success: false as const,
								error: "This snoozed email no longer exists.",
							};
						}
						if (mailbox.provider !== "IMAP") {
							await modifyMessageLabels(
								mailbox.accountId,
								snoozed.messageId,
								["INBOX", "UNREAD"],
								[],
							);
						}
						const localEmail = await getEmailById(
							mailboxId,
							snoozed.messageId,
						);
						if (localEmail) {
							const restored = Array.from(
								new Set([
									...snoozed.originalLabelIds,
									"INBOX",
									"UNREAD",
								]),
							);
							await updateEmailLabels(
								snoozed.messageId,
								restored,
							);
						}
						await cancelSnoozedEmail(snoozedEmailId, mailboxId);
						return { success: true as const };
					},
				}),
				createReminder: tool({
					description:
						"Create a reminder for the user at a future time. Reversible — runs immediately, no confirmation needed.",
					inputSchema: createReminderInput,
					execute: async ({ text, remindAt }) => {
						const at = new Date(remindAt);
						if (at.getTime() <= Date.now() - 60_000) {
							return {
								success: false as const,
								error: "Reminder time must be in the future.",
							};
						}
						const reminder = await createReminder({
							mailboxId,
							userId: context.user.id,
							text,
							remindAt: at,
						});
						return {
							success: true as const,
							id: reminder.id,
							remindAt: reminder.remindAt.toISOString(),
						};
					},
				}),
				listReminders: tool({
					description:
						"List the user's active (pending) reminders. Use for 'what are my reminders', 'what do I have coming up'.",
					inputSchema: z.object({}),
					execute: async () => {
						const reminders = await getActiveReminders(mailboxId);
						return {
							reminders: reminders.map((r) => ({
								id: r.id,
								text: r.text,
								remindAt: r.remindAt.toISOString(),
							})),
						};
					},
				}),
				cancelReminder: tool({
					description:
						"Cancel a pending reminder. Reversible — runs immediately, no confirmation needed.",
					inputSchema: cancelReminderInput,
					execute: async ({ reminderId }) => {
						const count = await cancelReminder(
							reminderId,
							mailboxId,
						);
						if (count === 0) {
							return {
								success: false as const,
								error: "This reminder no longer exists.",
							};
						}
						return { success: true as const };
					},
				}),
				// ── Risky action tools (needsApproval — client confirms first) ──
				sendEmail: tool({
					description:
						"Send an email now. IRREVERSIBLE — the user will see a confirmation card before this actually sends; call this once you have a resolved recipient, subject and body.",
					inputSchema: sendEmailInput,
					needsApproval: true,
					execute: async ({ to, cc, bcc, subject, body }) => {
						const { messageId } = await sendEmailForMailbox(
							mailbox.provider,
							{
								accountId: mailbox.accountId,
								from: mailbox.email,
								to,
								cc,
								bcc,
								subject,
								body,
							},
						);
						return { success: true, messageId };
					},
				}),
				sendSavedDraft: tool({
					description:
						"Send a previously saved draft now. IRREVERSIBLE — the user will see a confirmation card before this actually sends.",
					inputSchema: sendSavedDraftInput,
					needsApproval: true,
					execute: async ({ draftId }) => {
						if (mailbox.provider === "IMAP") {
							const sent = await sendImapDraft(
								mailbox.accountId,
								draftId,
								mailbox.email,
							);
							if (!sent) {
								return {
									success: false as const,
									error: "This draft no longer exists.",
								};
							}
							return { success: true, messageId: sent.messageId };
						}
						const result = await gmailSendDraft(
							mailbox.accountId,
							draftId,
						);
						return { success: true, messageId: result.id ?? null };
					},
				}),
				scheduleEmail: tool({
					description:
						"Schedule an email to send later at an absolute time. IRREVERSIBLE once due — the user will see a confirmation card before this is queued.",
					inputSchema: scheduleEmailInput,
					needsApproval: true,
					execute: async ({
						to,
						cc,
						bcc,
						subject,
						body,
						scheduledAt,
					}) => {
						const at = new Date(scheduledAt);
						if (at.getTime() <= Date.now() - 60_000) {
							return {
								success: false as const,
								error: "Scheduled time must be in the future.",
							};
						}
						const scheduled = await createScheduledEmail({
							mailboxId,
							to,
							cc,
							bcc,
							subject,
							body,
							scheduledAt: at,
						});
						return {
							success: true as const,
							id: scheduled.id,
							scheduledAt: scheduled.scheduledAt.toISOString(),
						};
					},
				}),
				deleteEmail: tool({
					description:
						"Permanently delete an email. IRREVERSIBLE — the user will see a confirmation card before this actually deletes.",
					inputSchema: deleteEmailInput,
					needsApproval: true,
					execute: async ({ emailId }) => {
						try {
							if (mailbox.provider === "IMAP") {
								await deleteImapMessage(
									mailbox.accountId,
									emailId,
								);
							} else {
								await gmailDeleteMessage(
									mailbox.accountId,
									emailId,
								);
							}
						} catch (error) {
							console.warn(
								"[inbox-assistant] deleteEmail: Gmail trash failed; removing locally",
								error,
							);
						}
						await deleteEmail(mailboxId, emailId);
						return { success: true };
					},
				}),
				trashEmail: tool({
					description:
						"Move an email to trash. IRREVERSIBLE-enough to confirm first — the user will see a confirmation card before this runs.",
					inputSchema: trashEmailInput,
					needsApproval: true,
					execute: async ({ emailId }) => {
						await getMailProvider(mailbox.provider).trash(
							mailbox.accountId,
							emailId,
						);
						const localEmail = await getEmailById(
							mailboxId,
							emailId,
						);
						if (localEmail) {
							const labels = localEmail.labelIds.filter(
								(l) => l !== "INBOX" && l !== "TRASH",
							);
							labels.push("TRASH");
							await updateEmailLabels(emailId, labels);
						}
						return { success: true };
					},
				}),
				createMeeting: tool({
					description:
						"Create a meeting with a joinable link (Google Meet or Zoom) and, if attendees are given, send calendar invites. IRREVERSIBLE — the user will see a confirmation card before invites are sent.",
					inputSchema: createMeetingInput,
					needsApproval: true,
					execute: async ({
						provider,
						summary,
						startIso,
						endIso,
						attendees,
						description,
					}) => {
						if (provider === "zoom") {
							try {
								const meeting = await createZoomMeeting(
									context.user.id,
									{ summary, startIso, endIso, description },
								);
								return { status: "ok" as const, meeting };
							} catch (error) {
								const result = classifyZoomError(error);
								if (result.status === "needsReconnect") {
									return {
										status: "needsReconnect" as const,
									};
								}
								return { status: "error" as const };
							}
						}
						if (mailbox.provider === "IMAP") {
							return {
								status: "error" as const,
								message:
									"Google Meet isn't available for this mailbox because it isn't a Google account. Offer to create a Zoom meeting instead.",
							};
						}
						try {
							const meeting = await createGoogleMeet(
								mailbox.accountId,
								{
									summary,
									startIso,
									endIso,
									attendees,
									description,
								},
							);
							return { status: "ok" as const, meeting };
						} catch (error) {
							const result = classifyCalendarError(error);
							if (result.status === "needsReconnect") {
								return {
									status: "needsReconnect" as const,
									message:
										"Calendar write access isn't granted. Tell the user to reconnect their Google account (Settings).",
								};
							}
							if (result.status === "serviceDisabled") {
								return { status: "serviceDisabled" as const };
							}
							return { status: "error" as const };
						}
					},
				}),
				createCalendarEvent: tool({
					description:
						"Create a plain calendar event with no meeting link. Use allDay: true with startDate/endDate for occasions with no specific time (birthdays, holidays, anniversaries) — never ask the user for a start/end time in that case, a full day is the correct default. IRREVERSIBLE — the user will see a confirmation card before invites (if any attendees) are sent.",
					inputSchema: createCalendarEventInput,
					needsApproval: true,
					execute: async (input) => {
						if (input.allDay) {
							if (!input.startDate || !input.endDate) {
								return {
									status: "error" as const,
									message:
										"allDay events require startDate and endDate (YYYY-MM-DD).",
								};
							}
						} else if (!input.startIso || !input.endIso) {
							return {
								status: "error" as const,
								message:
									"Timed events require startIso and endIso.",
							};
						}
						if (mailbox.provider === "IMAP") {
							try {
								const event = await createCalDavEvent(
									mailbox.accountId,
									{
										summary: input.summary,
										description: input.description,
										attendees: input.attendees,
										organizerEmail: mailbox.email,
										...(input.allDay
											? {
													allDayStart:
														input.startDate as string,
													allDayEnd:
														input.endDate as string,
												}
											: {
													startIso:
														input.startIso as string,
													endIso: input.endIso as string,
												}),
									},
								);
								return { status: "ok" as const, event };
							} catch (error) {
								return {
									status: "error" as const,
									message: `Couldn't create the event in the mail provider's calendar: ${error instanceof Error ? error.message : String(error)}`,
								};
							}
						}
						try {
							const event = await createCalendarEvent(
								mailbox.accountId,
								input.allDay
									? {
											summary: input.summary,
											allDay: true,
											startDate:
												input.startDate as string,
											endDate: input.endDate as string,
											attendees: input.attendees,
											description: input.description,
										}
									: {
											summary: input.summary,
											startIso: input.startIso as string,
											endIso: input.endIso as string,
											attendees: input.attendees,
											description: input.description,
										},
							);
							return { status: "ok" as const, event };
						} catch (error) {
							const result = classifyCalendarError(error);
							if (result.status === "needsReconnect") {
								return {
									status: "needsReconnect" as const,
									message:
										"Calendar write access isn't granted. Tell the user to reconnect their Google account (Settings).",
								};
							}
							if (result.status === "serviceDisabled") {
								return { status: "serviceDisabled" as const };
							}
							return { status: "error" as const };
						}
					},
				}),
				// Citation tool: the client renders the cards from this tool
				// part's `input.emailIds`. It still needs a server `execute` so
				// the streamText loop gets a tool result (a no-execute tool
				// would throw AI_MissingToolResultsError here, since we don't do
				// a client round-trip like the rules assistant does).
				citeEmails: tool({
					description:
						"Attach the specific emails your answer used so the user can open them. Call once, after your text answer.",
					inputSchema: citeEmailsInput,
					execute: async ({ emailIds }) => {
						return { cited: emailIds };
					},
				}),
			},
			onError: (error) => {
				console.error("[inbox-assistant] stream error", error);
			},
		});

		// Persist the new user turn + assistant reply once the stream completes,
		// so the conversation can be resumed later. Failures here must not break
		// the response the user already received.
		const uiStream = response.toUIMessageStream({
			originalMessages: messages as unknown as UIMessage[],
			onFinish: async ({ responseMessage, isAborted }) => {
				if (isAborted) {
					return;
				}
				try {
					const lastUser = [...messages]
						.reverse()
						.find((m) => m.role === "user");
					const toPersist: Array<{
						role: string;
						parts: unknown;
					}> = [];
					if (lastUser) {
						toPersist.push({
							role: "user",
							parts: lastUser.parts,
						});
					}
					toPersist.push({
						role: "assistant",
						parts: responseMessage.parts,
					});
					await appendMessages({
						conversationId,
						messages: toPersist as never,
					});
				} catch (err) {
					console.error(
						"[inbox-assistant] failed to persist messages",
						err,
					);
				}
			},
		});

		return streamToEventIterator(uiStream);
	});
