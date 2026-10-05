import { ORPCError } from "@orpc/client";
import { canUseRuleEngine } from "@repo/payments/lib/plan-limits";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { resolveUserPlan } from "../../payments/lib/resolve-plan";
import { verifyMailboxOwnership } from "../lib/ownership";
import { enableWatchForMailbox } from "../lib/watch-manager";

export const enableWatch = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/watch/enable",
		tags: ["Mailboxes"],
		summary: "Enable Gmail watch",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		// Check if user can use rule engine (Pro+ only)
		const planId = await resolveUserPlan(context.user.id);
		if (!canUseRuleEngine(planId)) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"Watch functionality is only available on Pro and Premium plans. Please upgrade to enable automatic email processing.",
			});
		}

		await enableWatchForMailbox(
			mailbox.id,
			mailbox.accountId,
			mailbox.provider as "GOOGLE" | "OUTLOOK",
		);
		return { success: true };
	});
