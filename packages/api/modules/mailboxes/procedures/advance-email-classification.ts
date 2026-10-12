import { ORPCError } from "@orpc/server";
import { getEmailClassificationRunById } from "@repo/database";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { processEmailClassificationRun } from "../lib/email-classification-backfill";
import { verifyMailboxOwnership } from "../lib/ownership";

export const advanceEmailClassification = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/classification/{runId}/advance",
		tags: ["Mailboxes"],
		summary: "Advance an email classification run",
		description:
			"Classifies the next chunk of uncategorized local emails for an existing classification run.",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			runId: z.string(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const run = await getEmailClassificationRunById(input.runId);
		if (!run || run.mailboxId !== input.mailboxId) {
			throw new ORPCError("NOT_FOUND");
		}

		return {
			run: await processEmailClassificationRun(input.runId),
		};
	});
