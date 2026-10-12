import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { getCalDavEventsResult } from "../lib/caldav-client";
import { getCalendarResult } from "../lib/calendar-client";
import { verifyMailboxOwnership } from "../lib/ownership";

export const getCalendarEvents = protectedProcedure
	.route({
		method: "GET",
		path: "/mailboxes/{mailboxId}/calendar/events",
		tags: ["Mailboxes"],
		summary: "Get upcoming calendar events for a mailbox",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			timeMin: z.string().optional(),
			timeMax: z.string().optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		// Custom (IMAP) mailboxes use the provider's own calendar over CalDAV
		// (e.g. Zoho Calendar) rather than Google.
		if (mailbox.provider === "IMAP") {
			const caldav = await getCalDavEventsResult(mailbox.accountId, {
				timeMin: input.timeMin,
				timeMax: input.timeMax,
			});
			return {
				needsReconnect: false as const,
				serviceDisabled: false as const,
				calendarError:
					caldav.status === "error" ? caldav.message : null,
				events: caldav.status === "ok" ? caldav.events : [],
			};
		}

		const result = await getCalendarResult(mailbox.accountId, {
			timeMin: input.timeMin,
			timeMax: input.timeMax,
		});

		switch (result.status) {
			case "ok":
				return {
					needsReconnect: false as const,
					serviceDisabled: false as const,
					calendarError: null,
					events: result.events,
				};
			case "serviceDisabled":
				console.error(
					"[calendar] Google Calendar API is disabled in GCP project",
				);
				return {
					needsReconnect: false as const,
					serviceDisabled: true as const,
					calendarError: null,
					events: [],
				};
			default:
				// needsReconnect or an unexpected error — the UI prompts a
				// reconnect in both cases, preserving prior behavior.
				if (result.status === "error") {
					console.error(
						"[calendar] unexpected error:",
						result.message,
					);
				}
				return {
					needsReconnect: true as const,
					serviceDisabled: false as const,
					calendarError: null,
					events: [],
				};
		}
	});
