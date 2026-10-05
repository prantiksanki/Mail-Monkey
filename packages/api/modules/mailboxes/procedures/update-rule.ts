import { ORPCError } from "@orpc/client";
import {
	findRuleByLabelInMailbox,
	findRuleByNameInMailbox,
	updateRule as updateRuleQuery,
} from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyRuleOwnership } from "../lib/ownership";
import { invalidateRuleSuggestionsCache } from "../lib/rule-suggestions";
import { UpdateRuleSchema } from "../types";

export const updateRule = protectedProcedure
	.route({
		method: "PUT",
		path: "/mailboxes/{mailboxId}/rules/{id}",
		tags: ["Mailboxes"],
		summary: "Update rule",
		description: "Update an existing rule",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			id: z.string(),
			data: UpdateRuleSchema,
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyRuleOwnership(input.id, input.mailboxId, context.user.id);

		// Enforce unique rule names per mailbox (case-insensitive), ignoring
		// the rule being updated so it can keep its own name.
		if (input.data.name !== undefined) {
			const existingRule = await findRuleByNameInMailbox({
				mailboxId: input.mailboxId,
				name: input.data.name,
				excludeId: input.id,
			});
			if (existingRule) {
				throw new ORPCError("CONFLICT", {
					message: "This rule is already exists.",
				});
			}
		}

		// Enforce unique label names per mailbox when the actions change,
		// ignoring this rule so it can keep its own label.
		if (input.data.actions !== undefined) {
			const newLabel = input.data.actions.find(
				(a) => a.type === "LABEL" && a.fields?.label,
			)?.fields?.label;
			if (newLabel) {
				const ruleWithLabel = await findRuleByLabelInMailbox({
					mailboxId: input.mailboxId,
					label: newLabel,
					excludeId: input.id,
				});
				if (ruleWithLabel) {
					throw new ORPCError("CONFLICT", {
						message: `A label named "${newLabel}" already exists.`,
					});
				}
			}
		}

		const updatedRule = await updateRuleQuery({
			id: input.id,
			name: input.data.name,
			condition: input.data.condition,
			actions: input.data.actions,
			enabled: input.data.enabled,
		});
		invalidateRuleSuggestionsCache(input.mailboxId);

		return {
			rule: updatedRule,
		};
	});
