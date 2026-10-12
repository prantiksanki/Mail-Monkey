import {
	createRuleBackfillRun,
	getActiveRuleBackfillRun,
	getLatestRuleBackfillRun,
} from "@repo/database";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyRuleOwnership } from "../lib/ownership";
import { buildBackfillQuery, getBackfillWindow } from "../lib/rule-backfill";
import { RuleBackfillWindowMonthsSchema } from "../types";

export const startRuleBackfill = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/rules/{ruleId}/backfill/start",
		tags: ["Mailboxes"],
		summary: "Start a historical rule backfill run",
		description:
			"Creates or resumes a chunked backfill run that applies a rule to historical inbox messages.",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			ruleId: z.string(),
			windowMonths: RuleBackfillWindowMonthsSchema.default("1"),
		}),
	)
	.handler(async ({ input, context }) => {
		const rule = await verifyRuleOwnership(
			input.ruleId,
			input.mailboxId,
			context.user.id,
		);

		const existingRun = await getActiveRuleBackfillRun(
			input.mailboxId,
			input.ruleId,
		);
		if (existingRun) {
			return { run: existingRun };
		}

		const windowMonths = Number.parseInt(input.windowMonths, 10);
		const { windowStart, windowEnd } = getBackfillWindow(windowMonths);
		const query = buildBackfillQuery(windowStart, windowEnd);
		const latestRun = await getLatestRuleBackfillRun(
			input.mailboxId,
			input.ruleId,
		);

		const run = await createRuleBackfillRun({
			mailboxId: input.mailboxId,
			ruleId: rule.id,
			status: "pending",
			windowMonths,
			windowStart,
			windowEnd,
			query,
		});

		return {
			run,
			previousRunCompletedAt: latestRun?.completedAt ?? null,
		};
	});
