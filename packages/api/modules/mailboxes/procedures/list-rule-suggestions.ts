import { ORPCError } from "@orpc/server";
import { logger } from "@repo/logs";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";
import { generateRuleSuggestions } from "../lib/rule-suggestions";

export const listRuleSuggestions = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/rules/suggestions",
		tags: ["Mailboxes"],
		summary: "List suggested rules from inbox history",
		description:
			"Analyzes recent inbox messages and suggests one-click rules the user can apply immediately.",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		try {
			return {
				suggestions: await generateRuleSuggestions(mailbox),
			};
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			const message =
				error instanceof Error ? error.message : String(error);
			logger.error(
				"[list-rule-suggestions] Failed to generate suggestions",
				{
					mailboxId: input.mailboxId,
					error: message,
				},
			);
			// Return empty suggestions instead of crashing the page
			return { suggestions: [] };
		}
	});
