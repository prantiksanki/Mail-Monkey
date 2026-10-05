import { getLatestRuleBackfillRun } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyRuleOwnership } from "../lib/ownership";

export const getRuleBackfillStatus = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/rules/{ruleId}/backfill",
		tags: ["Mailboxes"],
		summary: "Get the latest historical rule backfill status",
		description:
			"Returns the latest backfill run for a rule so the UI can resume or display results.",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			ruleId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyRuleOwnership(
			input.ruleId,
			input.mailboxId,
			context.user.id,
		);

		return {
			run: await getLatestRuleBackfillRun(input.mailboxId, input.ruleId),
		};
	});
