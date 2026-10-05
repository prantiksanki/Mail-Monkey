import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const getWatchStatus = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/watch/status",
		tags: ["Mailboxes"],
		summary: "Get watch status for a mailbox",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);
		return {
			watchEnabled: mailbox.watchEnabled,
			watchExpiry: mailbox.watchExpiry?.toISOString() ?? null,
		};
	});
