import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import {
	classifyCalendarError,
	createCalendarEvent,
} from "../lib/calendar-client";
import { verifyMailboxOwnership } from "../lib/ownership";

const timedInput = z.object({
	mailboxId: z.string(),
	summary: z.string().min(1).max(300),
	allDay: z.literal(false).optional(),
	startIso: z.string().datetime({ offset: true }),
	endIso: z.string().datetime({ offset: true }),
	attendees: z.array(z.string().email()).max(50).optional(),
	description: z.string().max(4000).optional(),
});

const allDayInput = z.object({
	mailboxId: z.string(),
	summary: z.string().min(1).max(300),
	allDay: z.literal(true),
	// Plain YYYY-MM-DD. endDate is exclusive per Google Calendar's all-day
	// convention (the day after the last day of the event).
	startDate: z.string().date(),
	endDate: z.string().date(),
	attendees: z.array(z.string().email()).max(50).optional(),
	description: z.string().max(4000).optional(),
});

/**
 * Creates a plain calendar event (no meeting link) for a mailbox. Google-only
 * — a plain event has no Zoom analog, unlike createMeeting. Supports a
 * full-day event (allDay: true + startDate/endDate) for occasions like a
 * birthday or holiday, alongside the timed variant.
 */
export const createCalendarEventProcedure = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/calendar/event",
		tags: ["Mailboxes"],
		summary: "Create a plain calendar event (no meeting link)",
	})
	.input(z.union([allDayInput, timedInput]))
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		try {
			const event = await createCalendarEvent(
				mailbox.accountId,
				input.allDay
					? {
							summary: input.summary,
							allDay: true,
							startDate: input.startDate,
							endDate: input.endDate,
							attendees: input.attendees,
							description: input.description,
						}
					: {
							summary: input.summary,
							startIso: input.startIso,
							endIso: input.endIso,
							attendees: input.attendees,
							description: input.description,
						},
			);

			// GA4 engagement event: a plain calendar event was created from
			// the inbox (Google-only; meeting links are tracked separately by
			// create-meeting's meeting_link_created).
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "calendar_event_created",
				userId: context.user.id,
				clientId,
				sessionId,
				params: { all_day: input.allDay === true },
			});

			return { status: "ok" as const, event };
		} catch (error) {
			const result = classifyCalendarError(error);
			if (result.status === "needsReconnect") {
				return { status: "needsReconnect" as const };
			}
			if (result.status === "serviceDisabled") {
				return { status: "serviceDisabled" as const };
			}
			console.error(
				"[create-calendar-event] failed:",
				result.status === "error" ? result.message : result.status,
			);
			return { status: "error" as const };
		}
	});
