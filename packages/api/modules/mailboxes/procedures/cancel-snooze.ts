import { ORPCError } from "@orpc/client";
import { cancelSnoozedEmail, getSnoozedEmailById } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";
import { restoreSnoozedToInbox } from "../lib/snooze-waker";

export const cancelSnoozeProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/snoozed/{id}/cancel",
		tags: ["Mailboxes"],
		summary: "Cancel a snooze and return the email to the inbox now",
	})
	.input(z.object({ mailboxId: z.string(), id: z.string() }))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		const snooze = await getSnoozedEmailById(input.id);
		if (
			!snooze ||
			snooze.mailboxId !== input.mailboxId ||
			snooze.status !== "SNOOZED"
		) {
			throw new ORPCError("NOT_FOUND", {
				message: "This snoozed email no longer exists.",
			});
		}

		// Unsnooze = bring it back to the inbox immediately, then mark canceled.
		await restoreSnoozedToInbox({
			mailboxId: snooze.mailboxId,
			messageId: snooze.messageId,
			originalLabelIds: snooze.originalLabelIds,
			mailbox: {
				accountId: mailbox.accountId,
				provider: mailbox.provider,
			},
		});
		await cancelSnoozedEmail(input.id, input.mailboxId);

		return { success: true };
	});
