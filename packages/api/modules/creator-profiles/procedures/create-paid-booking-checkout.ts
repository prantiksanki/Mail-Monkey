import { ORPCError } from "@orpc/client";
import {
	getBookablePublicProfileByUsername,
	getBookingsInRange,
} from "@repo/database";
import { logger } from "@repo/logs";
import { createCheckoutLink } from "@repo/payments";
import { config as paymentsConfig } from "@repo/payments/config";
import { getBaseUrl } from "@repo/utils";
import { publicProcedure } from "../../../orpc/procedures";
import { computeOpenSlots } from "../lib/slots";
import { createBookingSchema } from "../types";

export const createPaidBookingCheckout = publicProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/{username}/bookings/checkout",
		tags: ["Creator Profiles"],
		summary:
			"Start checkout for a paid slot on a creator's public calendar",
	})
	.input(createBookingSchema)
	.handler(async ({ input }) => {
		const profile = await getBookablePublicProfileByUsername(
			input.username,
		);

		if (!profile?.creatorProfile) {
			throw new ORPCError("NOT_FOUND");
		}

		if (!profile.creatorProfile.paidBookingEnabled) {
			throw new ORPCError("BAD_REQUEST", {
				message: "This creator does not require payment for bookings.",
			});
		}

		const meetingLengthMinutes =
			profile.creatorProfile.meetingLengthMinutes;
		const endsAt = new Date(
			input.startsAt.getTime() + meetingLengthMinutes * 60_000,
		);

		// Same server-side re-derivation as the free booking path — a forged
		// `startsAt` shouldn't be able to reach checkout for a closed slot.
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

		if (!paymentsConfig.paidBooking.productId) {
			logger.error("NEXT_PUBLIC_PRICE_ID_PAID_BOOKING is not configured");
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}

		try {
			const checkoutUrl = await createCheckoutLink({
				type: "one-time",
				productId: paymentsConfig.paidBooking.productId,
				email: input.visitorEmail,
				name: input.visitorName,
				redirectUrl: `${getBaseUrl()}/u/${input.username}?booked=1`,
				metadata: {
					booking_kind: "creator_profile_booking",
					booking_username: input.username,
					booking_starts_at: input.startsAt.toISOString(),
					booking_ends_at: endsAt.toISOString(),
					booking_visitor_name: input.visitorName,
					booking_visitor_email: input.visitorEmail,
					booking_note: input.note ?? "",
				},
			});

			if (!checkoutUrl) {
				throw new ORPCError("INTERNAL_SERVER_ERROR");
			}

			return { checkoutUrl };
		} catch (error) {
			if (error instanceof ORPCError) {
				throw error;
			}
			logger.error("Failed to create paid booking checkout", {
				error,
				username: input.username,
			});
			throw new ORPCError("INTERNAL_SERVER_ERROR");
		}
	});
