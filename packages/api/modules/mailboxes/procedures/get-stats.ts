import { getMailboxStats } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const getStats = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/stats",
		tags: ["Mailboxes"],
		summary: "Get mailbox dashboard stats",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);
		return getMailboxStats(input.mailboxId);
	});
