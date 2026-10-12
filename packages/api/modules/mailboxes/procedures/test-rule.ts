import { ORPCError } from "@orpc/client";
import { canUseRuleEngine } from "@repo/payments/lib/plan-limits";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import { getMailProvider } from "../lib/mail-provider";
import { verifyMailboxOwnership, verifyRuleOwnership } from "../lib/ownership";
import { evaluateRule } from "../lib/rule-evaluator";
import type { RuleCondition } from "../types";

export const testRule = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/rules/{id}/test",
		tags: ["Mailboxes"],
		summary: "Test rule",
		description:
			"Dry-run a rule against the 10 most recent inbox emails to check matches",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			id: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		const planId = await resolveUserPlan(context.user.id);
		if (!canUseRuleEngine(planId)) {
			throw new ORPCError("FORBIDDEN", {
				message: "Testing rules requires a Pro or Premium plan.",
			});
		}

		const rule = await verifyRuleOwnership(
			input.id,
			input.mailboxId,
			context.user.id,
		);

		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const provider = mailbox.provider as "GOOGLE" | "OUTLOOK" | "IMAP";
		const mailProvider = getMailProvider(provider);

		let list: Awaited<ReturnType<typeof mailProvider.listInboxMessages>>;
		try {
			list = await mailProvider.listInboxMessages(mailbox.accountId, {
				maxResults: 10,
			});
		} catch {
			return { results: [], matchCount: 0, total: 0 };
		}

		if (!list.messages.length) {
			return { results: [], matchCount: 0, total: 0 };
		}

		const results = await Promise.all(
			list.messages.map(async (msg) => {
				const parsed = await mailProvider.getParsedMessage(
					mailbox.accountId,
					msg.id,
				);
				const matched = await evaluateRule(
					parsed,
					rule.condition as RuleCondition,
				);
				return {
					messageId: parsed.id,
					subject: parsed.subject,
					from: parsed.from,
					matched,
				};
			}),
		);

		return {
			results,
			matchCount: results.filter((r) => r.matched).length,
			total: results.length,
		};
	});
