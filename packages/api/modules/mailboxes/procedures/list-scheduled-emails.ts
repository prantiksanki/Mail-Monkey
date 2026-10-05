import { getPendingScheduledEmails } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const listScheduledEmails = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/scheduled",
		tags: ["Mailboxes"],
		summary: "List pending scheduled emails",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const scheduled = await getPendingScheduledEmails(input.mailboxId);

		return {
			scheduled: scheduled.map((s) => ({
				id: s.id,
				to: s.to,
				subject: s.subject,
				scheduledAt: s.scheduledAt.toISOString(),
			})),
		};
	});
