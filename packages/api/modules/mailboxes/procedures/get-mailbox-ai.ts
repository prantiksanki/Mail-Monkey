import { z } from "zod";
import { getMailboxAi } from "../../../lib/supabase";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

// AI enrichment (labels + priority + summary) for a mailbox's emails, keyed by
// email id — the app merges this with the inbox list it fetches from Neon.
export const getMailboxAiProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/ai",
		tags: ["Mailboxes"],
		summary: "Get AI labels/insights for a mailbox's emails",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);
		const rows = await getMailboxAi(input.mailboxId);
		return { items: rows };
	});
