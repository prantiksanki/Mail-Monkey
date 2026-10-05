import {
	createExecutionLog,
	getRuleBackfillRunById,
	updateRuleBackfillRun,
	wasMessageProcessedByRule,
} from "@repo/database";
import { logger } from "@repo/logs";
import type { RuleAction, RuleCondition } from "../types";
import { executeActions } from "./action-executor";
import { getMailProvider } from "./mail-provider";
import { evaluateRule } from "./rule-evaluator";

// Prisma P2025 — "record required but not found" (e.g. cascade-deleted mid-run)
function isPrismaNotFound(e: unknown): boolean {
	return (
		typeof e === "object" &&
		e !== null &&
		"code" in e &&
		(e as { code: string }).code === "P2025"
	);
}

const RULE_BACKFILL_CHUNK_SIZE = 25;
const RULE_BACKFILL_MAX_EMAILS = 90;
const processingRuns = new Set<string>();

function formatGmailDate(date: Date): string {
	return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

export function buildBackfillQuery(windowStart: Date, windowEnd: Date) {
	return `after:${formatGmailDate(windowStart)} before:${formatGmailDate(windowEnd)}`;
}

export function getBackfillWindow(windowMonths: number) {
	const windowEnd = new Date();
	windowEnd.setDate(windowEnd.getDate() + 1);
	const windowStart = new Date(windowEnd);
	windowStart.setMonth(windowStart.getMonth() - windowMonths);
	return { windowStart, windowEnd };
}

export async function processRuleBackfillRun(runId: string) {
	const run = await getRuleBackfillRunById(runId);

	if (!run) {
		throw new Error(`Backfill run ${runId} not found`);
	}

	if (run.status === "completed" || run.status === "failed") {
		return run;
	}

	if (processingRuns.has(run.id)) {
		return run;
	}
	processingRuns.add(run.id);

	try {
		try {
			await updateRuleBackfillRun({
				id: run.id,
				status: "running",
				lastError: null,
			});
		} catch (e) {
			if (!isPrismaNotFound(e)) {
				throw e;
			}
			return run;
		}

		try {
			const provider = (run.mailbox.provider ?? "GOOGLE") as
				| "GOOGLE"
				| "OUTLOOK";
			const mailProvider = getMailProvider(provider);

			// Parse window dates from the stored ISO strings (Outlook) or query (Gmail)
			const windowStart = run.windowStart
				? new Date(run.windowStart)
				: undefined;
			const windowEnd = run.windowEnd
				? new Date(run.windowEnd)
				: undefined;

			const remaining = RULE_BACKFILL_MAX_EMAILS - run.processedCount;
			if (remaining <= 0) {
				return await updateRuleBackfillRun({
					id: run.id,
					status: "completed",
					nextPageToken: null,
					estimatedTotal: run.processedCount,
					processedCount: run.processedCount,
					matchedCount: run.matchedCount,
					appliedCount: run.appliedCount,
					skippedCount: run.skippedCount,
					errorCount: run.errorCount,
					completedAt: new Date(),
				});
			}

			const listResult = await mailProvider.listInboxMessages(
				run.mailbox.accountId,
				{
					maxResults: Math.min(RULE_BACKFILL_CHUNK_SIZE, remaining),
					pageToken: run.nextPageToken ?? undefined,
					windowStart,
					windowEnd,
				},
			);

			const messages = listResult.messages ?? [];
			let processedCount = run.processedCount;
			let matchedCount = run.matchedCount;
			let appliedCount = run.appliedCount;
			let skippedCount = run.skippedCount;
			let errorCount = run.errorCount;

			for (const message of messages) {
				if (!message.id) {
					continue;
				}

				processedCount += 1;

				try {
					const alreadyProcessed = await wasMessageProcessedByRule(
						run.ruleId,
						message.id,
						run.id,
					);
					if (alreadyProcessed) {
						skippedCount += 1;
						continue;
					}

					const email = await mailProvider.getParsedMessage(
						run.mailbox.accountId,
						message.id,
					);

					// Skip self-sent messages
					const isSentByMailbox =
						email.fromEmail === run.mailbox.email.toLowerCase() ||
						email.labelIds.includes("SENT");
					if (isSentByMailbox) {
						skippedCount += 1;
						continue;
					}

					const matched = await evaluateRule(
						email,
						run.rule.condition as RuleCondition,
					);

					if (!matched) {
						skippedCount += 1;
						continue;
					}

					matchedCount += 1;
					const actionResults = await executeActions(
						run.mailbox.accountId,
						email,
						run.rule.actions as RuleAction[],
						run.mailbox.email,
						provider,
						run.mailboxId,
					);
					const allOk = actionResults.every((r) => r.success);

					await createExecutionLog({
						ruleId: run.ruleId,
						mailboxId: run.mailboxId,
						messageId: email.id,
						threadId: email.threadId,
						subject: email.subject,
						from: email.from,
						status: allOk ? "matched" : "error",
						actionsRun: actionResults,
						error:
							actionResults
								.filter((r) => !r.success)
								.map((r) => r.error)
								.join("; ") || undefined,
					});

					if (allOk) {
						appliedCount += 1;
					} else {
						errorCount += 1;
					}
				} catch (error) {
					errorCount += 1;
					logger.error("[rule-backfill] Failed to process message", {
						runId: run.id,
						messageId: message.id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}

			const hitLimit = processedCount >= RULE_BACKFILL_MAX_EMAILS;
			const nextPageToken = hitLimit
				? null
				: (listResult.nextPageToken ?? null);
			const isComplete = !nextPageToken;
			// When done, use actual processedCount as the total — Gmail's
			// resultSizeEstimate is approximate and often wrong.
			const estimatedTotal = isComplete
				? processedCount
				: (run.estimatedTotal ??
					listResult.resultSizeEstimate ??
					processedCount);

			return await updateRuleBackfillRun({
				id: run.id,
				status: isComplete ? "completed" : "running",
				nextPageToken,
				estimatedTotal,
				processedCount,
				matchedCount,
				appliedCount,
				skippedCount,
				errorCount,
				completedAt: isComplete ? new Date() : null,
			});
		} catch (error) {
			logger.error("[rule-backfill] Backfill run failed", {
				runId: run.id,
				error: error instanceof Error ? error.message : String(error),
			});

			try {
				return await updateRuleBackfillRun({
					id: run.id,
					status: "failed",
					lastError:
						error instanceof Error ? error.message : String(error),
					completedAt: new Date(),
				});
			} catch (updateError) {
				// Row was deleted (rule/mailbox cascade) while we were running.
				if (isPrismaNotFound(updateError)) {
					return null;
				}
				throw updateError;
			}
		}
	} finally {
		processingRuns.delete(run.id);
	}
}
