import { toggleRuleEnabled } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyRuleOwnership } from "../lib/ownership";
import { invalidateRuleSuggestionsCache } from "../lib/rule-suggestions";

export const toggleRule = protectedProcedure
	.route({
		method: "PUT",
		path: "/mailboxes/{mailboxId}/rules/{id}/toggle",
		tags: ["Mailboxes"],
		summary: "Toggle rule",
		description: "Toggle rule enabled status",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			id: z.string(),
			enabled: z.boolean(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyRuleOwnership(input.id, input.mailboxId, context.user.id);

		const updatedRule = await toggleRuleEnabled({
			id: input.id,
			enabled: input.enabled,
		});
		invalidateRuleSuggestionsCache(input.mailboxId);

		return {
			rule: updatedRule,
		};
	});
