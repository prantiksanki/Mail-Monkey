import { ORPCError } from "@orpc/client";
import { upsertCreatorProfile } from "@repo/database";
import { logger } from "@repo/logs";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";

export const updatePaidBookingSettings = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/me/paid-booking",
		tags: ["Creator Profiles"],
		summary: "Toggle whether the current user's bookings require payment",
	})
	.input(z.object({ paidBookingEnabled: z.boolean() }))
	.handler(async ({ input, context }) => {
		try {
			await upsertCreatorProfile(context.user.id, input);
		} catch (error) {
			logger.error("Failed to update paid booking settings", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
