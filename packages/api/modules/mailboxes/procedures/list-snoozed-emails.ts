import { getActiveSnoozedEmails } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const listSnoozedEmails = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/snoozed",
		tags: ["Mailboxes"],
		summary: "List snoozed emails",
	})
	.input(z.object({ mailboxId: z.string() }))
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const snoozed = await getActiveSnoozedEmails(input.mailboxId);

		return {
			snoozed: snoozed.map((s) => ({
				id: s.id,
				messageId: s.messageId,
				from: s.from,
				subject: s.subject,
				snippet: s.snippet,
				snoozeUntil: s.snoozeUntil.toISOString(),
				internalDate: s.internalDate.toISOString(),
			})),
		};
	});
