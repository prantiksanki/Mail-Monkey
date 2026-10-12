import { getActiveReminders } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const listRemindersProcedure = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/reminders",
		tags: ["Mailboxes"],
		summary: "List active reminders",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const reminders = await getActiveReminders(input.mailboxId);

		return {
			reminders: reminders.map((r) => ({
				id: r.id,
				text: r.text,
				remindAt: r.remindAt.toISOString(),
			})),
		};
	});
