import { ORPCError } from "@orpc/client";
import {
	createRule as createRuleQuery,
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

		// Note: multiple rules may intentionally share the same label (e.g. the
		// suggestion engine groups newsletters from many senders under a single
		// "Newsletter" label), so we do NOT enforce label uniqueness here.

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
