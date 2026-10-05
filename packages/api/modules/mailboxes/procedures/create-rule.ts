import { ORPCError } from "@orpc/client";
import {
	createRule as createRuleQuery,
	findRuleByLabelInMailbox,
	findRuleByNameInMailbox,
	getRulesByMailboxId,
} from "@repo/database";
import { canCreateRule } from "@repo/payments/lib/plan-limits";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import { verifyMailboxOwnership } from "../lib/ownership";
import { invalidateRuleSuggestionsCache } from "../lib/rule-suggestions";
import { CreateRuleSchema } from "../types";

export const createRule = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/rules",
		tags: ["Mailboxes"],
		summary: "Create rule",
		description: "Create a new rule for a mailbox",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			data: CreateRuleSchema,
		}),
	)
	.handler(async ({ input, context }) => {
		const _mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		// Check rule count limit for this mailbox
		const planId = await resolveUserPlan(context.user.id);
		const currentRules = await getRulesByMailboxId({
			mailboxId: input.mailboxId,
		});
		if (!canCreateRule(planId, currentRules.length)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"You've reached the limit for rules on this mailbox. Upgrade to a higher plan for more rules.",
			});
		}

		// Enforce unique rule names per mailbox (case-insensitive).
		const existingRule = await findRuleByNameInMailbox({
			mailboxId: input.mailboxId,
			name: input.data.name,
		});
		if (existingRule) {
			throw new ORPCError("CONFLICT", {
				message: "This rule is already exists.",
			});
		}

		// Enforce unique label names per mailbox: a mailbox can have at most one
		// label of a given name, so two rules can't create the same label.
		const newLabel = input.data.actions.find(
			(a) => a.type === "LABEL" && a.fields?.label,
		)?.fields?.label;
		if (newLabel) {
			const ruleWithLabel = await findRuleByLabelInMailbox({
				mailboxId: input.mailboxId,
				label: newLabel,
			});
			if (ruleWithLabel) {
				throw new ORPCError("CONFLICT", {
					message: `A label named "${newLabel}" already exists.`,
				});
			}
		}

		const rule = await createRuleQuery({
			mailboxId: input.mailboxId,
			name: input.data.name,
			condition: input.data.condition,
			actions: input.data.actions,
			enabled: input.data.enabled,
		});
		invalidateRuleSuggestionsCache(input.mailboxId);

		return {
			rule,
		};
	});
