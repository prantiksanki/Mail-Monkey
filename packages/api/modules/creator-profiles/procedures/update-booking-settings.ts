import { ORPCError } from "@orpc/client";
import {
	replaceWeeklyAvailability,
	upsertCreatorProfile,
} from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import { updateBookingSettingsSchema } from "../types";

export const updateBookingSettings = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/me/booking-settings",
		tags: ["Creator Profiles"],
		summary: "Update the current user's booking availability settings",
	})
	.input(updateBookingSettingsSchema)
	.handler(async ({ input, context }) => {
		try {
			const { availability, ...settings } = input;

			const profile = await upsertCreatorProfile(
				context.user.id,
				settings,
			);

			if (availability) {
				await replaceWeeklyAvailability(profile.id, availability);
			}
		} catch (error) {
			logger.error("Failed to update booking settings", {
				error,
				userId: context.user.id,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
