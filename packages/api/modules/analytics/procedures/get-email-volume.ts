import { getEmailsProcessedOverTime } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const getEmailVolume = protectedProcedure
	.route({
		method: "GET",
		path: "/analytics/email-volume",
		tags: ["Analytics"],
		summary: "Get email processing volume over time",
		description:
			"Returns daily email processing counts for the specified number of past days.",
	})
	.input(
		z.object({
			days: z.number().min(1).max(90).default(30),
		}),
	)
	.handler(async ({ input, context }) => {
		const volume = await getEmailsProcessedOverTime(
			context.user.id,
			input.days,
		);
		return { volume };
	});
