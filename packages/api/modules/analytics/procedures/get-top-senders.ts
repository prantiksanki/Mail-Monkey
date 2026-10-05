import { getTopEmailSenders } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const getTopSenders = protectedProcedure
	.route({
		method: "GET",
		path: "/analytics/top-senders",
		tags: ["Analytics"],
		summary: "Get top email senders",
		description:
			"Returns the most frequent email senders across all of the user's mailboxes.",
	})
	.input(
		z.object({
			limit: z.number().min(1).max(50).default(10),
		}),
	)
	.handler(async ({ input, context }) => {
		const senders = await getTopEmailSenders(context.user.id, input.limit);
		return { senders };
	});
