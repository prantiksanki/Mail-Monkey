import { ORPCError } from "@orpc/client";
import {
	declineBooking as declineBookingById,
	getBookingById,
} from "@repo/database";
import { logger } from "@repo/logs";
import { sendEmail } from "@repo/mail";
import { protectedProcedure } from "../../../orpc/procedures";
import { buildBookingDeclinedEmail } from "../lib/booking-emails";
import { bookingActionSchema } from "../types";

/**
 * Declines a pending booking, releasing the slot, and emails the visitor a
 * notice. The decline email goes through the platform's transactional sender
 * (not the host's Gmail) — unlike Accept, nothing here requires the host's
 * connected account, so a failed notice email doesn't block the decline
 * itself from taking effect.
 */
export const declineBooking = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/bookings/{bookingId}/decline",
		tags: ["Creator Profiles"],
		summary: "Decline a pending booking",
	})
	.input(bookingActionSchema)
	.handler(async ({ input, context }) => {
		const booking = await getBookingById(input.bookingId);
		if (!booking) {
			throw new ORPCError("NOT_FOUND");
		}
		if (booking.creatorProfile.userId !== context.user.id) {
			throw new ORPCError("FORBIDDEN");
		}

		const declined = await declineBookingById(booking.id);
		if (!declined) {
			throw new ORPCError("CONFLICT", {
				message: "This booking is no longer pending.",
			});
		}

		try {
			const { subject, html, text } = buildBookingDeclinedEmail({
				visitorName: booking.visitorName,
				hostName: booking.creatorProfile.user.name,
				startsAt: booking.startsAt,
				timeZone: booking.creatorProfile.bookingTimezone,
			});
			await sendEmail({ to: booking.visitorEmail, subject, html, text });
		} catch (error) {
			// The decline itself already succeeded and the slot is released —
			// a failed notice email shouldn't roll that back.
			logger.error("Failed to send booking decline notice", {
				error,
				bookingId: booking.id,
			});
		}

		return { status: "ok" as const };
	});
