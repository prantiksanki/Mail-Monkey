import { ORPCError } from "@orpc/client";
import { createReminder } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const createReminderProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/reminders",
		tags: ["Mailboxes"],
		summary: "Create a reminder",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			text: z.string().min(1).max(500),
			remindAt: z.string().datetime({ offset: true }),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const remindAt = new Date(input.remindAt);
		// Require a future time (small grace window for clock skew).
		if (remindAt.getTime() <= Date.now() - 60_000) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Reminder time must be in the future.",
			});
		}

		const reminder = await createReminder({
			mailboxId: input.mailboxId,
			userId: context.user.id,
			text: input.text,
			remindAt,
		});

		return {
			id: reminder.id,
			text: reminder.text,
			remindAt: reminder.remindAt.toISOString(),
		};
	});
