import { deleteRule as deleteRuleQuery } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyRuleOwnership } from "../lib/ownership";
import { invalidateRuleSuggestionsCache } from "../lib/rule-suggestions";

export const deleteRule = protectedProcedure
	.route({
		method: "DELETE",
		path: "/mailboxes/{mailboxId}/rules/{id}",
		tags: ["Mailboxes"],
		summary: "Delete rule",
		description: "Delete a rule",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			id: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyRuleOwnership(input.id, input.mailboxId, context.user.id);

		await deleteRuleQuery(input.id);
		invalidateRuleSuggestionsCache(input.mailboxId);

		return {
			success: true,
		};
	});
