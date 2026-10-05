import { z } from "zod";
import { getMailboxTasks } from "../../../lib/supabase";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

// Money & smart tasks extracted from the mailbox (payments + action items).
export const getMailboxTasksProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/tasks",
		tags: ["Mailboxes"],
		summary: "Get extracted payments and action items",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);
		return { items: await getMailboxTasks(input.mailboxId) };
	});
