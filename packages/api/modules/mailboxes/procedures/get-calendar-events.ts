import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import { listUpcomingEvents } from "../lib/calendar-client";
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

		try {
			const events = await listUpcomingEvents(mailbox.accountId, {
				timeMin: input.timeMin,
				timeMax: input.timeMax,
			});
			return {
				needsReconnect: false as const,
				serviceDisabled: false as const,
				events,
			};
		} catch (error) {
			if (error instanceof ORPCError) {
				return {
					needsReconnect: true as const,
					serviceDisabled: false as const,
					events: [],
				};
			}

			const msg = error instanceof Error ? error.message : String(error);
			const status =
				(error as { status?: number; code?: number })?.status ??
				(error as { status?: number; code?: number })?.code;

			const isServiceDisabled =
				status === 403 &&
				(msg.includes("accessNotConfigured") ||
					msg.includes("SERVICE_DISABLED") ||
					msg.includes("has not been used") ||
					msg.includes("has not been enabled"));

			if (isServiceDisabled) {
				console.error(
					"[calendar] Google Calendar API is disabled in GCP project:",
					msg,
				);
				return {
					needsReconnect: false as const,
					serviceDisabled: true as const,
					events: [],
				};
			}

			if (
				status === 401 ||
				status === 403 ||
				msg.includes("invalid_grant") ||
				msg.includes("insufficientPermissions") ||
				msg.includes("insufficient authentication scopes") ||
				msg.includes("Request had insufficient") ||
				msg.includes("UNAUTHORIZED")
			) {
				return {
					needsReconnect: true as const,
					serviceDisabled: false as const,
					events: [],
				};
			}

			console.error("[calendar] unexpected error:", msg, error);
			return {
				needsReconnect: true as const,
				serviceDisabled: false as const,
				events: [],
			};
		}
	});
