import { ORPCError } from "@orpc/client";
import { getCreatorProfileByUserId, getUpcomingBookings } from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";

export const listMyBookings = protectedProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/me/bookings",
		tags: ["Creator Profiles"],
		summary: "List the current user's upcoming bookings",
	})
	.handler(async ({ context }) => {
		try {
			const profile = await getCreatorProfileByUserId(context.user.id);
			if (!profile) {
				return [];
			}
			return await getUpcomingBookings(profile.id);
		} catch (error) {
			logger.error("Failed to list bookings", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
