import {
	countUncategorizedEmails,
	createEmailClassificationRun,
	getActiveEmailClassificationRun,
} from "@repo/database";
import { z } from "zod";
import { userExpensiveLimiter } from "../../../orpc/middleware/rate-limit-user";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const startEmailClassification = protectedProcedure
	.use(userExpensiveLimiter)
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/classification/start",
		tags: ["Mailboxes"],
		summary: "Start classifying synced emails into Dashboard categories",
		description:
			"Creates or resumes a chunked run that classifies every uncategorized local email into Primary/Newsletter/Promotion/Social.",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const existingRun = await getActiveEmailClassificationRun(
			input.mailboxId,
		);
		if (existingRun) {
			return { run: existingRun };
		}

		const totalAtStart = await countUncategorizedEmails(input.mailboxId);

		const run = await createEmailClassificationRun({
			mailboxId: input.mailboxId,
			status: "pending",
			totalAtStart,
		});

		return { run };
	});
