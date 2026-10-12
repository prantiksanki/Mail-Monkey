import { ORPCError } from "@orpc/client";
import { cancelReminder } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const cancelReminderProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/reminders/{id}/cancel",
		tags: ["Mailboxes"],
		summary: "Cancel a pending reminder",
	})
	.input(z.object({ mailboxId: z.string(), id: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const count = await cancelReminder(input.id, input.mailboxId);
		if (count === 0) {
			throw new ORPCError("NOT_FOUND", {
				message: "This reminder no longer exists.",
			});
		}

		return { success: true };
	});
