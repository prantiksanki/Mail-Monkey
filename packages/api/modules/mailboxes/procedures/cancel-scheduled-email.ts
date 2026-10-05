import { ORPCError } from "@orpc/client";
import { cancelScheduledEmail } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const cancelScheduledEmailProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/scheduled/{id}/cancel",
		tags: ["Mailboxes"],
		summary: "Cancel a pending scheduled email",
	})
	.input(z.object({ mailboxId: z.string(), id: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const count = await cancelScheduledEmail(input.id, input.mailboxId);
		if (count === 0) {
			throw new ORPCError("NOT_FOUND", {
				message:
					"This scheduled email no longer exists or has already been sent.",
			});
		}

		return { success: true };
	});
