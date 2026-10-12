import { ORPCError } from "@orpc/client";
import { cancelBooking as cancelBookingByToken } from "@repo/database";
import { logger } from "@repo/logs";
import { publicProcedure } from "../../../orpc/procedures";
import { cancelBookingSchema } from "../types";

export const cancelBooking = publicProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/bookings/cancel",
		tags: ["Creator Profiles"],
		summary: "Cancel a booking using its cancel token",
	})
	.input(cancelBookingSchema)
	.handler(async ({ input }) => {
		try {
			const canceled = await cancelBookingByToken(input.cancelToken);
			if (!canceled) {
				throw new ORPCError("NOT_FOUND");
			}
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to cancel booking", { error });
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
