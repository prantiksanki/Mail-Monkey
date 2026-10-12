import { ORPCError } from "@orpc/client";
import { markNotificationRead } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const markRead = protectedProcedure
	.route({
		method: "POST",
		path: "/notifications/mark-read",
		tags: ["Notifications"],
		summary: "Mark notification read",
		description: "Mark one of the current user's notifications as read",
	})
	.input(z.object({ id: z.string() }))
	.handler(async ({ input: { id }, context: { user } }) => {
		const marked = await markNotificationRead(id, user.id);
		if (!marked) {
			throw new ORPCError("NOT_FOUND");
		}

		return { success: true };
	});
