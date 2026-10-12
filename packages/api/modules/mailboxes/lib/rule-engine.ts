import {
	createExecutionLog,
	db,
	getEmailById,
	incrementEmailsProcessed,
	updateEmailLabels,
	updateMailboxHistoryId,
	upsertEmail,
	wasMessageAlreadyProcessed,
} from "@repo/database";
import { logger } from "@repo/logs";
import { queueDepth } from "@repo/metrics";
import {
	canProcessEmail,
	canUseRuleEngine,
} from "@repo/payments/lib/plan-limits";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import type { RuleAction, RuleCondition } from "../types";
import { executeActions } from "./action-executor";
import { listHistory } from "./gmail-client";
import { getMailProvider } from "./mail-provider";
import { evaluateRule } from "./rule-evaluator";
import { disableWatchForMailbox } from "./watch-manager";

const QUEUE_NAME = "rule-processing";

// Per-mailbox lock to prevent concurrent processing
const processingMailboxes = new Set<string>();

function trackMailboxProcessing(mailboxId: string) {
	processingMailboxes.add(mailboxId);
	queueDepth.set({ queue_name: QUEUE_NAME }, processingMailboxes.size);
}

function untrackMailboxProcessing(mailboxId: string) {
	processingMailboxes.delete(mailboxId);
	queueDepth.set({ queue_name: QUEUE_NAME }, processingMailboxes.size);
}

export async function processMailboxNotification(mailbox: {
	id: string;
	email: string;
	accountId: string;
	lastHistoryId: string | null;
	userId: string;
}) {
	if (!mailbox.lastHistoryId) {
		logger.warn("No lastHistoryId, skipping", { mailboxId: mailbox.id });
		return;
	}

	if (processingMailboxes.has(mailbox.id)) {
		logger.debug(
			"Mailbox already being processed, skipping duplicate notification",
			{ mailboxId: mailbox.id },
		);
		return;
	}
	trackMailboxProcessing(mailbox.id);

	try {
		await processMailboxMessages({
			...mailbox,
			lastHistoryId: mailbox.lastHistoryId,
		});
	} finally {
		untrackMailboxProcessing(mailbox.id);
	}
}

export async function processOutlookNotification(
	mailbox: {
		id: string;
		email: string;
		accountId: string;
		userId: string;
	},
	messageIds: string[],
) {
	if (messageIds.length === 0) {
		return;
	}

	if (processingMailboxes.has(mailbox.id)) {
		logger.debug(
			"Mailbox already being processed, skipping Outlook notification",
			{ mailboxId: mailbox.id },
		);
		return;
	}
	trackMailboxProcessing(mailbox.id);

	try {
		await processMessages({
			...mailbox,
			provider: "OUTLOOK",
			messageIds,
		});
	} finally {
		untrackMailboxProcessing(mailbox.id);
	}
}

async function processMailboxMessages(mailbox: {
	id: string;
	email: string;
	accountId: string;
	lastHistoryId: string;
	userId: string;
}) {
	const planId = await resolveUserPlan(mailbox.userId);
	if (!canUseRuleEngine(planId)) {
		logger.info(
			"[rule-engine] Rule engine not available for this plan, auto-disabling watch",
			{ mailboxId: mailbox.id, planId },
		);
		await db.mailbox.update({
			where: { id: mailbox.id },
			data: { watchEnabled: false },
		});
		return;
	}

	let newMessageIds: string[] = [];
	let latestHistoryId = mailbox.lastHistoryId;

	logger.info("[rule-engine] Starting history fetch", {
		mailboxId: mailbox.id,
		email: mailbox.email,
		lastHistoryId: mailbox.lastHistoryId,
	});

	// Latest known label state per message, from labelAdded/labelRemoved
	// history records. Gmail reports the message's *full* current labelIds
	// alongside each label-change record, so the last one wins.
	const labelUpdates = new Map<string, string[]>();

	try {
		const history = await listHistory(
			mailbox.accountId,
			mailbox.lastHistoryId,
			{ historyTypes: ["messageAdded", "labelAdded", "labelRemoved"] },
		);
		latestHistoryId = history.historyId ?? mailbox.lastHistoryId;

		logger.info("[rule-engine] listHistory returned", {
			mailboxId: mailbox.id,
			returnedHistoryId: latestHistoryId,
			historyRecordCount: history.history?.length ?? 0,
		});

		if (history.history) {
			for (const record of history.history) {
				for (const added of record.messagesAdded ?? []) {
					if (added.message?.id) {
						if (added.message.labelIds?.includes("SENT")) {
							logger.debug(
								"[rule-engine] Skipping SENT message in history",
								{
									messageId: added.message.id,
									mailboxId: mailbox.id,
								},
							);
							continue;
						}
						newMessageIds.push(added.message.id);
					}
				}
				for (const changed of [
					...(record.labelsAdded ?? []),
					...(record.labelsRemoved ?? []),
				]) {
					if (changed.message?.id && changed.message.labelIds) {
						labelUpdates.set(
							changed.message.id,
							changed.message.labelIds,
						);
					}
				}
			}
		}
	} catch (error: unknown) {
		const is404 =
			error instanceof Error &&
			(error.message.includes("404") ||
				error.message.toLowerCase().includes("not found") ||
				("code" in error &&
					(error as { code: unknown }).code === 404) ||
				("status" in error &&
					(error as { status: unknown }).status === 404));

		if (is404) {
			logger.warn(
				"[rule-engine] History ID expired (404), resetting lastHistoryId",
				{
					mailboxId: mailbox.id,
					expiredHistoryId: mailbox.lastHistoryId,
					errorMessage:
						error instanceof Error ? error.message : String(error),
				},
			);
			await updateMailboxHistoryId(mailbox.id, latestHistoryId);
			return;
		}
		logger.error("[rule-engine] listHistory threw unexpected error", {
			mailboxId: mailbox.id,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}

	newMessageIds = [...new Set(newMessageIds)];

	logger.info("[rule-engine] New message IDs after dedup", {
		mailboxId: mailbox.id,
		count: newMessageIds.length,
	});

	// Mirror label changes (e.g. a label applied by hand in Gmail, or by a
	// Gmail filter) onto already-synced messages. Messages that are also in
	// newMessageIds are skipped here — processMessages below fetches them
	// fresh from Gmail and writes their current labelIds already.
	const newIdSet = new Set(newMessageIds);
	for (const [messageId, labelIds] of labelUpdates) {
		if (newIdSet.has(messageId)) {
			continue;
		}
		const localEmail = await getEmailById(mailbox.id, messageId);
		if (localEmail) {
			await updateEmailLabels(messageId, labelIds);
			logger.info(
				"[rule-engine] Mirrored Gmail label change to local DB",
				{
					mailboxId: mailbox.id,
					messageId,
				},
			);
		}
	}

	if (newMessageIds.length === 0) {
		await updateMailboxHistoryId(mailbox.id, latestHistoryId);
		return;
	}

	await processMessages({
		id: mailbox.id,
		email: mailbox.email,
		accountId: mailbox.accountId,
		userId: mailbox.userId,
		provider: "GOOGLE",
		messageIds: newMessageIds,
	});

	await updateMailboxHistoryId(mailbox.id, latestHistoryId);
}

async function processMessages(mailbox: {
	id: string;
	email: string;
	accountId: string;
	userId: string;
	provider: "GOOGLE" | "OUTLOOK";
	messageIds: string[];
}) {
	const planId = await resolveUserPlan(mailbox.userId);
	if (!canUseRuleEngine(planId)) {
		logger.info(
			"[rule-engine] Rule engine not available for this plan, disabling watch",
			{ mailboxId: mailbox.id, planId },
		);
		const row = await db.mailbox.findUnique({
			where: { id: mailbox.id },
			select: { subscriptionId: true },
		});
		await disableWatchForMailbox(
			mailbox.id,
			mailbox.accountId,
			mailbox.provider,
			row?.subscriptionId,
		);
		return;
	}

	const rules = await db.rule.findMany({
		where: { mailboxId: mailbox.id, enabled: true },
		orderBy: { createdAt: "asc" },
	});

	if (rules.length === 0) {
		return;
	}

	const currentMonthProcessed = await db.mailboxUsageTracking.findUnique({
		where: {
			mailboxId_periodStart: {
				mailboxId: mailbox.id,
				periodStart: new Date(
					new Date().getFullYear(),
					new Date().getMonth(),
					1,
				),
			},
		},
	});
	let localProcessedCount = currentMonthProcessed?.emailsProcessed ?? 0;

	const mailProvider = getMailProvider(mailbox.provider);

	for (const msgId of mailbox.messageIds) {
		if (!canProcessEmail(planId, localProcessedCount)) {
			logger.warn(
				"[rule-engine] Email processing limit reached for this month",
				{ mailboxId: mailbox.id, processedCount: localProcessedCount },
			);
			return;
		}

		const alreadyProcessed = await wasMessageAlreadyProcessed(
			mailbox.id,
			msgId,
		);
		if (alreadyProcessed) {
			logger.info("[rule-engine] Message already processed, skipping", {
				messageId: msgId,
				mailboxId: mailbox.id,
			});
			continue;
		}

		try {
			const email = await mailProvider.getParsedMessage(
				mailbox.accountId,
				msgId,
			);

			// Persist to local DB before running actions so the email record
			// exists when action-executor calls updateEmailLabels.
			try {
				await upsertEmail({
					id: email.id,
					mailboxId: mailbox.id,
					threadId: email.threadId,
					from: email.from,
					fromEmail: email.fromEmail,
					to: email.to,
					subject: email.subject,
					snippet: email.snippet,
					bodyText: email.bodyText,
					bodyHtml: email.bodyHtml,
					labelIds: email.labelIds,
					isUnread: email.labelIds.includes("UNREAD"),
					internalDate: email.date,
				});
			} catch (err) {
				logger.warn("[rule-engine] Failed to upsert email to DB", {
					messageId: email.id,
					error: err instanceof Error ? err.message : String(err),
				});
			}

			logger.info("[rule-engine] Message parsed", {
				messageId: msgId,
				subject: email.subject,
				from: email.from,
			});

			// Skip self-sent messages (Gmail check via labelIds; Outlook via fromEmail)
			const isSentByMailbox =
				email.fromEmail === mailbox.email.toLowerCase() ||
				email.labelIds.includes("SENT");
			if (isSentByMailbox) {
				logger.info("[rule-engine] Skipping self-sent message", {
					messageId: msgId,
					mailboxId: mailbox.id,
				});
				continue;
			}

			let matched = false;
			for (const rule of rules) {
				const condition = rule.condition as RuleCondition;
				try {
					const ruleMatched = await evaluateRule(email, condition);

					if (ruleMatched) {
						matched = true;
						logger.info(
							"[rule-engine] Rule matched — executing actions",
							{
								ruleId: rule.id,
								ruleName: rule.name,
								messageId: email.id,
							},
						);

						const actions = rule.actions as RuleAction[];
						const results = await executeActions(
							mailbox.accountId,
							email,
							actions,
							mailbox.email,
							mailbox.provider,
							mailbox.id,
						);

						await createExecutionLog({
							ruleId: rule.id,
							mailboxId: mailbox.id,
							messageId: email.id,
							threadId: email.threadId,
							subject: email.subject,
							from: email.from,
							status: results.every((r) => r.success)
								? "matched"
								: "error",
							actionsRun: results,
							error:
								results
									.filter((r) => !r.success)
									.map((r) => r.error)
									.join("; ") || undefined,
						});
					}
				} catch (ruleError) {
					logger.error("Rule evaluation failed", {
						ruleId: rule.id,
						messageId: email.id,
						error:
							ruleError instanceof Error
								? ruleError.message
								: String(ruleError),
					});
					await createExecutionLog({
						ruleId: rule.id,
						mailboxId: mailbox.id,
						messageId: email.id,
						threadId: email.threadId,
						subject: email.subject,
						from: email.from,
						status: "error",
						error:
							ruleError instanceof Error
								? ruleError.message
								: String(ruleError),
					});
				}
			}

			if (matched) {
				await incrementEmailsProcessed(mailbox.id, 1);
				localProcessedCount++;
			}
		} catch (msgError) {
			logger.error("Failed to process message", {
				messageId: msgId,
				error:
					msgError instanceof Error
						? msgError.message
						: String(msgError),
			});
		}
	}
}
