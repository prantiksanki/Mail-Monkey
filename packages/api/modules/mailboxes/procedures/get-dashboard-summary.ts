import { getDashboardSummary, getMailboxStats } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { buildAiInsightSentence } from "../lib/dashboard-insight";
import { verifyMailboxOwnership } from "../lib/ownership";

export const getDashboardSummaryProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/dashboard/summary",
		tags: ["Mailboxes"],
		summary:
			"Get Dashboard summary (Inbox Zero, Priority, categories, top senders, AI insight)",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const [summary, mailboxStats] = await Promise.all([
			getDashboardSummary(input.mailboxId),
			getMailboxStats(input.mailboxId),
		]);

		return {
			...summary,
			aiInsight: buildAiInsightSentence(mailboxStats.actionsBreakdown24h),
		};
	});
