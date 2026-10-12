import {
	createExecutionLog,
	db,
	wasMessageAlreadyProcessed,
} from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { executeActions } from "../lib/action-executor";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership } from "../lib/ownership";
import { evaluateRule } from "../lib/rule-evaluator";
import type { RuleAction, RuleCondition } from "../types";

// Onboarding-only: applies the user's enabled rules to the 50 most recent
// INBOX messages. Bypasses the plan-gated rule engine so every user sees
// their rules work once during onboarding. Background pub/sub processing
// stays gated by plan via rule-engine.ts.

interface AppliedResult {
	messageId: string;
	subject: string;
	from: string;
	matchedRuleId: string | null;
	matchedRuleName: string | null;
	actions: string[];
	status: "applied" | "skipped" | "error";
	error?: string;
}

export const applyRulesToRecent = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/rules/apply-recent",
		tags: ["Mailboxes"],
		summary: "Apply rules to recent messages (onboarding)",
		description:
			"Applies all enabled rules to the 50 most recent INBOX messages. Intended for onboarding — bypasses the rule engine plan gate so every user gets a live demo. Short-circuits on the first matching rule per message.",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(
		async ({ input, context }): Promise<{ results: AppliedResult[] }> => {
			const mailbox = await verifyMailboxOwnership(
				input.mailboxId,
				context.user.id,
			);

			const rules = await db.rule.findMany({
				where: { mailboxId: mailbox.id, enabled: true },
				orderBy: { createdAt: "asc" },
			});

			if (rules.length === 0) {
				return { results: [] };
			}

			const provider = mailbox.provider as "GOOGLE" | "OUTLOOK" | "IMAP";
			const mailProvider = getMailProvider(provider);

			let list: Awaited<
				ReturnType<typeof mailProvider.listInboxMessages>
			>;
			try {
				list = await mailProvider.listInboxMessages(mailbox.accountId, {
					maxResults: 50,
				});
			} catch (error) {
				logger.error(
					"[apply-rules-to-recent] Failed to list messages",
					{
						mailboxId: mailbox.id,
						error:
							error instanceof Error
								? error.message
								: String(error),
					},
				);
				return { results: [] };
			}

			if (!list.messages?.length) {
				return { results: [] };
			}

			const results: AppliedResult[] = [];

			for (const msg of list.messages) {
				if (!msg.id) {
					continue;
				}

				let alreadyProcessed = false;
				try {
					alreadyProcessed = await wasMessageAlreadyProcessed(
						mailbox.id,
						msg.id,
					);
				} catch {
					// DB error — treat as unprocessed and attempt processing
				}
				if (alreadyProcessed) {
					// Still surface a row so the UI shows something for this message.
					try {
						const parsed = await mailProvider.getParsedMessage(
							mailbox.accountId,
							msg.id,
						);
						results.push({
							messageId: parsed.id,
							subject: parsed.subject,
							from: parsed.from,
							matchedRuleId: null,
							matchedRuleName: null,
							actions: [],
							status: "skipped",
						});
					} catch {
						// fetch failed — skip the row entirely
					}
					continue;
				}

				try {
					const email = await mailProvider.getParsedMessage(
						mailbox.accountId,
						msg.id,
					);

					// Safety: never act on messages we sent
					if (
						email.fromEmail === mailbox.email.toLowerCase() ||
						email.labelIds.includes("SENT")
					) {
						results.push({
							messageId: email.id,
							subject: email.subject,
							from: email.from,
							matchedRuleId: null,
							matchedRuleName: null,
							actions: [],
							status: "skipped",
						});
						continue;
					}

					let matchedResult: AppliedResult | null = null;

					for (const rule of rules) {
						const condition = rule.condition as RuleCondition;
						const matched = await evaluateRule(email, condition);

						if (!matched) {
							continue;
						}

						const actions = rule.actions as RuleAction[];
						const actionResults = await executeActions(
							mailbox.accountId,
							email,
							actions,
							mailbox.email,
							provider,
							mailbox.id,
						);

						const allOk = actionResults.every((r) => r.success);

						await createExecutionLog({
							ruleId: rule.id,
							mailboxId: mailbox.id,
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

						matchedResult = {
							messageId: email.id,
							subject: email.subject,
							from: email.from,
							matchedRuleId: rule.id,
							matchedRuleName: rule.name,
							actions: actionResults.map((r) => r.type),
							status: allOk ? "applied" : "error",
							error: allOk
								? undefined
								: actionResults
										.filter((r) => !r.success)
										.map((r) => r.error)
										.join("; "),
						};

						// Short-circuit — first match wins per message, matches prod
						// rule-engine semantics for the single-rule-per-email case.
						break;
					}

					results.push(
						matchedResult ?? {
							messageId: email.id,
							subject: email.subject,
							from: email.from,
							matchedRuleId: null,
							matchedRuleName: null,
							actions: [],
							status: "skipped",
						},
					);
				} catch (error) {
					logger.error(
						"[apply-rules-to-recent] Failed to process message",
						{
							messageId: msg.id,
							mailboxId: mailbox.id,
							error:
								error instanceof Error
									? error.message
									: String(error),
						},
					);
					results.push({
						messageId: msg.id,
						subject: "",
						from: "",
						matchedRuleId: null,
						matchedRuleName: null,
						actions: [],
						status: "error",
						error:
							error instanceof Error
								? error.message
								: String(error),
					});
				}
			}

			return { results };
		},
	);
