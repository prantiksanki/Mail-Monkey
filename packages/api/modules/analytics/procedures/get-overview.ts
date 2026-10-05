import {
	getActiveRulesCount,
	getAutomationSuccessRate,
	getTotalEmailsProcessed,
} from "@repo/database";
import { protectedProcedure } from "../../../orpc/procedures";

export const getOverview = protectedProcedure
	.route({
		method: "GET",
		path: "/analytics/overview",
		tags: ["Analytics"],
		summary: "Get analytics overview",
		description:
			"Returns high-level analytics for the current user: total emails processed, automation success rate, and active rules count.",
	})
	.handler(async ({ context }) => {
		const userId = context.user.id;

		const [totalEmails, successRate, rulesCount] = await Promise.all([
			getTotalEmailsProcessed(userId),
			getAutomationSuccessRate(userId),
			getActiveRulesCount(userId),
		]);

		return {
			totalEmailsProcessed: totalEmails,
			automationSuccessRate: successRate,
			activeRules: rulesCount,
		};
	});
