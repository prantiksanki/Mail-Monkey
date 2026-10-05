import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { enrichMailbox } from "../lib/enrich";
import { verifyMailboxOwnership } from "../lib/ownership";

// Backfill/refresh AI enrichment (embeddings + labels + summary) into Supabase.
export const enrichMailboxProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/enrich",
		tags: ["Mailboxes"],
		summary: "Enrich emails into the AI DB (embeddings + labels + summary)",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			limit: z.number().min(1).max(200).default(40),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);
		return enrichMailbox(input.mailboxId, { limit: input.limit });
	});
