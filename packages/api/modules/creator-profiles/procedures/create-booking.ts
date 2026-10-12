import { ORPCError } from "@orpc/client";
import {
	createBookingIfFree,
	createNotification,
	getBookablePublicProfileByUsername,
	getBookingsInRange,
	recordProfileEvent,
} from "@repo/database";
import { logger } from "@repo/logs";
import { nanoid } from "nanoid";
import { publicProcedure } from "../../../orpc/procedures";
import { computeOpenSlots } from "../lib/slots";
import { createBookingSchema } from "../types";

export const createBooking = publicProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/{username}/bookings",
		tags: ["Creator Profiles"],
		summary: "Book a slot on a creator's public calendar",
	})
	.input(createBookingSchema)
	.handler(async ({ input }) => {
		const profile = await getBookablePublicProfileByUsername(
			input.username,
		);

		if (!profile?.creatorProfile) {
			throw new ORPCError("NOT_FOUND");
		}

		const meetingLengthMinutes =
			profile.creatorProfile.meetingLengthMinutes;
		const endsAt = new Date(
			input.startsAt.getTime() + meetingLengthMinutes * 60_000,
		);

		// Re-derive the open slots server-side rather than trusting the client's
		// chosen time, so a forged `startsAt` can't book outside real availability.
		const rangeStart = new Date(input.startsAt.getTime() - 60_000);
		const rangeEnd = new Date(endsAt.getTime() + 60_000);
		const booked = await getBookingsInRange(
			profile.creatorProfile.id,
			rangeStart,
			rangeEnd,
		);
		const openSlots = computeOpenSlots({
			windows: profile.creatorProfile.availability,
			booked,
			timeZone: profile.creatorProfile.bookingTimezone,
			meetingLengthMinutes,
			from: rangeStart,
			to: rangeEnd,
		});

		const requestedIsOpen = openSlots.some(
			(slot) => slot.startsAt.getTime() === input.startsAt.getTime(),
		);
		if (!requestedIsOpen) {
			throw new ORPCError("CONFLICT", {
				message: "That time is no longer available.",
			});
		}

		try {
			const cancelToken = nanoid(24);
			const booking = await createBookingIfFree({
				creatorProfileId: profile.creatorProfile.id,
				visitorName: input.visitorName,
				visitorEmail: input.visitorEmail,
				note: input.note,
				startsAt: input.startsAt,
				endsAt,
				cancelToken,
			});

			if (!booking) {
				throw new ORPCError("CONFLICT", {
					message: "That time was just booked by someone else.",
				});
			}

			await createNotification({
				userId: profile.id,
				type: "creator_profile_booking_requested",
				title: `New booking request from ${input.visitorName}`,
				body: `${input.startsAt.toLocaleString()} — ${meetingLengthMinutes} min\n\nReply to: ${input.visitorEmail}${input.note ? `\n\n${input.note}` : ""}\n\nAccept or decline in your Bookings page.`,
			});
			await recordProfileEvent(profile.creatorProfile.id, "BOOKING");

			return {
				cancelToken: booking.cancelToken,
				startsAt: booking.startsAt,
			};
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to create booking", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
