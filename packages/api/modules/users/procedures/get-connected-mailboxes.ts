import { ORPCError } from "@orpc/client";
import { getMailboxesByUserId } from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";

export const getConnectedMailboxes = protectedProcedure
	.route({
		method: "GET",
		path: "/users/connected-mailboxes",
		tags: ["Users"],
		summary: "Get all connected mailboxes for the current user",
	})
	.handler(async ({ context }) => {
		try {
			const mailboxes = await getMailboxesByUserId(context.user.id);
			return mailboxes || [];
		} catch (error) {
			logger.error("Failed to fetch mailboxes for userId:", {
				error: error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Could not fetch mailboxes from database",
			});
		}
	});
