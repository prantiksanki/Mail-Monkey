import { ORPCError } from "@orpc/client";
import { createScheduledEmail } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { verifyMailboxOwnership } from "../lib/ownership";

export const scheduleEmail = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/schedule",
		tags: ["Mailboxes"],
		summary: "Schedule an email to send later",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			to: z.string().min(1, "Recipient is required"),
			cc: z.string().optional(),
			bcc: z.string().optional(),
			subject: z.string().min(1, "Subject is required"),
			body: z.string().min(1, "Body is required"),
			scheduledAt: z.string().datetime(),
		}),
	)
	.handler(async ({ input, context }) => {
		await verifyMailboxOwnership(input.mailboxId, context.user.id);

		const scheduledAt = new Date(input.scheduledAt);
		// Require a future time (small grace window for clock skew).
		if (scheduledAt.getTime() <= Date.now() - 60_000) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Scheduled time must be in the future.",
			});
		}

		const scheduled = await createScheduledEmail({
			mailboxId: input.mailboxId,
			to: input.to,
			cc: input.cc,
			bcc: input.bcc,
			subject: input.subject,
			body: input.body,
			scheduledAt,
		});

		return {
			id: scheduled.id,
			scheduledAt: scheduled.scheduledAt.toISOString(),
		};
	});
