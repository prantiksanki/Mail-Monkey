import { ORPCError } from "@orpc/server";
import { getRuleBackfillRunById } from "@repo/database";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";
import { processRuleBackfillRun } from "../lib/rule-backfill";

export const advanceRuleBackfill = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/rules/backfill/{runId}/advance",
		tags: ["Mailboxes"],
		summary: "Advance a historical rule backfill run",
		description:
			"Processes the next chunk of messages for an existing historical rule backfill run.",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			runId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const run = await getRuleBackfillRunById(input.runId);
		if (!run || run.mailboxId !== input.mailboxId) {
			throw new ORPCError("NOT_FOUND");
		}

		return {
			run: await processRuleBackfillRun(input.runId),
		};
	});
