import { getUnreadNotificationsByUserId } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const listNotifications = protectedProcedure
	.route({
		method: "GET",
		path: "/notifications",
		tags: ["Notifications"],
		summary: "List notifications",
		description: "Get the current user's unread notifications",
	})
	.input(z.object({}))
	.handler(async ({ context: { user } }) => {
		const notifications = await getUnreadNotificationsByUserId(user.id);

		return { notifications };
	});
