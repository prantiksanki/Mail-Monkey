import { ORPCError } from "@orpc/client";
import {
	getBookablePublicProfileByUsername,
	getBookingsInRange,
} from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import { computeOpenSlots } from "../lib/slots";
import { getAvailableSlotsSchema } from "../types";

const MAX_RANGE_DAYS = 35;

export const getAvailableSlots = publicProcedure
	.route({
		method: "GET",
		path: "/creator-profiles/{username}/slots",
		tags: ["Creator Profiles"],
		summary: "Get a creator's open booking slots in a date range",
	})
	.input(getAvailableSlotsSchema)
	.handler(async ({ input }) => {
		if (input.to <= input.from) {
			throw new ORPCError("BAD_REQUEST", {
				message: "`to` must be after `from`",
			});
		}
		const rangeDays =
			(input.to.getTime() - input.from.getTime()) / (24 * 60 * 60 * 1000);
		if (rangeDays > MAX_RANGE_DAYS) {
			throw new ORPCError("BAD_REQUEST", {
				message: `Range cannot exceed ${MAX_RANGE_DAYS} days`,
			});
		}

		try {
			const profile = await getBookablePublicProfileByUsername(
				input.username,
			);

			if (!profile?.creatorProfile) {
				throw new ORPCError("NOT_FOUND");
			}

			const booked = await getBookingsInRange(
				profile.creatorProfile.id,
				input.from,
				input.to,
			);

			const slots = computeOpenSlots({
				windows: profile.creatorProfile.availability,
				booked,
				timeZone: profile.creatorProfile.bookingTimezone,
				meetingLengthMinutes:
					profile.creatorProfile.meetingLengthMinutes,
				from: input.from,
				to: input.to,
			});

			return slots.map((s) => ({
				startsAt: s.startsAt.toISOString(),
				endsAt: s.endsAt.toISOString(),
			}));
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to compute available slots", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
