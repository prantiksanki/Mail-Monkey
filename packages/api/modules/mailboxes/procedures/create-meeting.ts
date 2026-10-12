import { parseGaCookies, trackServerEvent } from "@repo/analytics";
import { getMailboxesByUserId } from "@repo/database";
import { z } from "zod";
import { protectedProcedure } from "../../../orpc/procedures";
import {
	classifyCalendarError,
	createGoogleMeet,
} from "../lib/calendar-client";
import {
	classifyTeamsMeetingError,
	createOutlookMeeting,
} from "../lib/outlook-client";
import { verifyMailboxOwnership } from "../lib/ownership";
import {
	classifyZohoError,
	createZohoMeeting,
} from "../lib/zoho-meeting-client";
import { classifyZoomError, createZoomMeeting } from "../lib/zoom-client";

/**
 * Creates a meeting link for a mailbox. Supports Google Meet (via the connected
 * Google account's Calendar), Zoom and Zoho Meeting (via the user's connected
 * account for each), and Microsoft Teams (via a connected Outlook mailbox's
 * calendar). Returns a classified result so the UI can prompt a reconnect when
 * the write scope / connection is missing, mirroring the calendar-events endpoint.
 */
export const createMeeting = protectedProcedure
	.route({
		method: "POST",
		path: "/mailboxes/{mailboxId}/calendar/meeting",
		tags: ["Mailboxes"],
		summary: "Create a meeting link (Google Meet or Zoom) for a mailbox",
	})
	.input(
		z.object({
			mailboxId: z.string(),
			provider: z
				.enum(["google", "zoom", "zoho", "outlook"])
				.default("google"),
			summary: z.string().min(1).max(300),
			startIso: z.string().datetime(),
			endIso: z.string().datetime(),
			attendees: z.array(z.string().email()).max(50).optional(),
			description: z.string().max(4000).optional(),
		}),
	)
	.handler(async ({ input, context }) => {
		// Ownership check also gates Zoom/Zoho: the caller must own a mailbox to
		// reach the inbox where meeting links are attached, even though those
		// accounts are per-user rather than per-mailbox.
		const mailbox = await verifyMailboxOwnership(
			input.mailboxId,
			context.user.id,
		);

		// GA4 engagement event, fired once per successful link. `provider` lets
		// the "which meeting integration is actually used" question be answered
		// alongside the zoom_connect / zoho_connect activation events.
		const trackMeetingLinkCreated = async (provider: string) => {
			const { clientId, sessionId } = parseGaCookies(
				context.headers.get("cookie"),
			);
			await trackServerEvent({
				name: "meeting_link_created",
				userId: context.user.id,
				clientId,
				sessionId,
				params: { provider },
			});
		};

		if (input.provider === "zoom") {
			try {
				const meeting = await createZoomMeeting(context.user.id, {
					summary: input.summary,
					startIso: input.startIso,
					endIso: input.endIso,
					description: input.description,
				});
				await trackMeetingLinkCreated("zoom");
				return { status: "ok" as const, meeting };
			} catch (error) {
				const result = classifyZoomError(error);
				if (result.status === "needsReconnect") {
					return { status: "needsReconnect" as const };
				}
				console.error(
					"[create-meeting] zoom failed:",
					result.status === "error" ? result.message : result.status,
				);
				return { status: "error" as const };
			}
		}

		if (input.provider === "zoho") {
			try {
				const meeting = await createZohoMeeting(context.user.id, {
					summary: input.summary,
					startIso: input.startIso,
					endIso: input.endIso,
					description: input.description,
				});
				await trackMeetingLinkCreated("zoho");
				return { status: "ok" as const, meeting };
			} catch (error) {
				const result = classifyZohoError(error);
				if (result.status === "needsReconnect") {
					return { status: "needsReconnect" as const };
				}
				console.error(
					"[create-meeting] zoho failed:",
					result.status === "error" ? result.message : result.status,
				);
				return { status: "error" as const };
			}
		}

		if (input.provider === "outlook") {
			// Teams links come from a connected Outlook (Microsoft) account:
			// prefer the current mailbox if it's an Outlook one, otherwise fall
			// back to the user's first connected Outlook mailbox.
			const outlookAccountId =
				mailbox.provider === "OUTLOOK"
					? mailbox.accountId
					: (await getMailboxesByUserId(context.user.id)).find(
							(m) => m.provider === "OUTLOOK",
						)?.accountId;

			if (!outlookAccountId) {
				// No Outlook mailbox connected — the UI prompts a connect.
				return { status: "needsReconnect" as const };
			}

			try {
				const meeting = await createOutlookMeeting(outlookAccountId, {
					summary: input.summary,
					startIso: input.startIso,
					endIso: input.endIso,
					attendees: input.attendees,
					description: input.description,
				});
				await trackMeetingLinkCreated("teams");
				return { status: "ok" as const, meeting };
			} catch (error) {
				const result = classifyTeamsMeetingError(error);
				if (result.status === "needsReconnect") {
					return { status: "needsReconnect" as const };
				}
				console.error("[create-meeting] teams failed:", result.message);
				return { status: "error" as const };
			}
		}

		try {
			const meeting = await createGoogleMeet(mailbox.accountId, {
				summary: input.summary,
				startIso: input.startIso,
				endIso: input.endIso,
				attendees: input.attendees,
				description: input.description,
			});
			await trackMeetingLinkCreated("google_meet");
			return { status: "ok" as const, meeting };
		} catch (error) {
			const result = classifyCalendarError(error);
			if (result.status === "needsReconnect") {
				return { status: "needsReconnect" as const };
			}
			if (result.status === "serviceDisabled") {
				return { status: "serviceDisabled" as const };
			}
			console.error(
				"[create-meeting] failed:",
				result.status === "error" ? result.message : result.status,
			);
			return { status: "error" as const };
		}
	});
