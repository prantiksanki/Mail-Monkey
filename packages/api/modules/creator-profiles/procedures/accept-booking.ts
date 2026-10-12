import { ORPCError } from "@orpc/client";
import {
	beginAcceptingBooking,
	createNotification,
	getBookingById,
	getMailboxesByUserId,
	markBookingConfirmed,
	patchBookingAcceptState,
	revertBookingToPending,
} from "@repo/database";
import { logger } from "@repo/logs";
import { protectedProcedure } from "../../../orpc/procedures";
import {
	classifyCalendarError,
	createGoogleMeet,
} from "../../mailboxes/lib/calendar-client";
import { sendEmailViaGmail } from "../../mailboxes/lib/email-sender";
import { buildBookingConfirmationEmail } from "../lib/booking-emails";
import { bookingActionSchema } from "../types";

/**
 * Accepts a pending booking: creates a Google Meet + Calendar event on the
 * host's Google Calendar, emails the visitor a confirmation from the host's
 * own Gmail account, then flips the booking to CONFIRMED. Only successful
 * once every step has completed — a failure partway through leaves the
 * booking in ACCEPTING with whatever it has completed so far persisted, so a
 * retried Accept resumes instead of redoing (and re-emailing) completed work.
 */
export const acceptBooking = protectedProcedure
	.route({
		method: "POST",
		path: "/creator-profiles/bookings/{bookingId}/accept",
		tags: ["Creator Profiles"],
		summary: "Accept a pending booking and create the meeting",
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

		if (booking.status === "CONFIRMED") {
			// Already fully accepted — treat a repeat click as a success no-op.
			return { status: "ok" as const, booking };
		}
		if (booking.status === "DECLINED" || booking.status === "CANCELED") {
			throw new ORPCError("CONFLICT", {
				message: "This booking is no longer pending.",
			});
		}

		if (booking.status === "PENDING") {
			const claimed = await beginAcceptingBooking(booking.id);
			if (!claimed) {
				throw new ORPCError("CONFLICT", {
					message: "Already being processed — try again shortly.",
				});
			}
		}
		// booking.status is now ACCEPTING (either just claimed above, or this
		// call is a retry resuming a previous partial attempt).

		const hostMailbox = (await getMailboxesByUserId(context.user.id)).find(
			(m) => m.provider === "GOOGLE",
		);
		if (!hostMailbox) {
			await revertBookingToPending(booking.id, "no_google_mailbox");
			return { status: "needsGoogleMailbox" as const };
		}

		let meetLink = booking.meetLink;
		let calendarEventId = booking.calendarEventId;

		if (!meetLink || !calendarEventId) {
			try {
				const meeting = await createGoogleMeet(hostMailbox.accountId, {
					summary: `Meeting with ${booking.visitorName}`,
					startIso: booking.startsAt.toISOString(),
					endIso: booking.endsAt.toISOString(),
					attendees: [booking.visitorEmail],
					description: booking.note ?? undefined,
				});
				meetLink = meeting.meetLink;
				calendarEventId = meeting.eventId;
				await patchBookingAcceptState(booking.id, {
					meetLink,
					calendarEventId,
				});
			} catch (error) {
				const result = classifyCalendarError(error);
				const reason =
					result.status === "error" ? result.message : result.status;
				logger.error("Failed to create Google Meet for booking", {
					error,
					bookingId: booking.id,
				});
				// Nothing was created yet — safe to drop back to PENDING so a
				// fresh Accept click starts clean.
				await revertBookingToPending(booking.id, reason);
				if (result.status === "needsReconnect") {
					return { status: "needsReconnect" as const };
				}
				if (result.status === "serviceDisabled") {
					return { status: "serviceDisabled" as const };
				}
				return { status: "error" as const, message: reason };
			}
		}

		if (booking.confirmationEmailStatus !== "SENT") {
			try {
				const { subject, html } = buildBookingConfirmationEmail({
					visitorName: booking.visitorName,
					hostName: booking.creatorProfile.user.name,
					startsAt: booking.startsAt,
					endsAt: booking.endsAt,
					timeZone: booking.creatorProfile.bookingTimezone,
					note: booking.note,
					meetLink,
				});
				await sendEmailViaGmail({
					accountId: hostMailbox.accountId,
					from: hostMailbox.email,
					to: booking.visitorEmail,
					subject,
					body: html,
				});
				await patchBookingAcceptState(booking.id, {
					confirmationEmailStatus: "SENT",
					confirmationEmailSentAt: new Date(),
				});
			} catch (error) {
				logger.error("Failed to send booking confirmation email", {
					error,
					bookingId: booking.id,
				});
				// The meeting already exists — don't recreate it on retry, just
				// leave the booking ACCEPTING with the email marked failed so a
				// retry re-attempts only the send.
				await patchBookingAcceptState(booking.id, {
					confirmationEmailStatus: "FAILED",
					acceptError: "email_send_failed",
				});
				return {
					status: "emailFailed" as const,
					meetLink,
				};
			}
		}

		await markBookingConfirmed(booking.id, { meetLink, calendarEventId });

		await createNotification({
			userId: context.user.id,
			type: "creator_profile_booking_confirmed",
			title: `Meeting confirmed with ${booking.visitorName}`,
			body: `${booking.startsAt.toLocaleString()}\n\n${meetLink}`,
		});

		const updated = await getBookingById(booking.id);
		return { status: "ok" as const, booking: updated ?? booking };
	});
