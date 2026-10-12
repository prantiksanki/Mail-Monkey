import { getLatestEmailClassificationRun } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const getEmailClassificationStatus = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/classification",
		tags: ["Mailboxes"],
		summary: "Get the latest email classification run status",
		description:
			"Returns the latest classification run for a mailbox so the UI can resume or display progress.",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		return {
			run: await getLatestEmailClassificationRun(input.mailboxId),
		};
	});
