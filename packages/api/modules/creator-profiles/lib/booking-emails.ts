// Content builders for the two booking-lifecycle emails. The acceptance
// confirmation is sent through the host's own connected Gmail account (via
// sendEmailViaGmail), not the platform's transactional sender — so its HTML
// is built directly here rather than as a packages/mail React Email template,
// mirroring how sendEmailViaGmail's other callers (mailbox compose) already
// pass plain HTML strings instead of rendered templates.

interface BookingEmailInput {
	visitorName: string;
	hostName: string;
	startsAt: Date;
	endsAt: Date;
	timeZone: string;
	note?: string | null;
}

function formatWhen(startsAt: Date, endsAt: Date, timeZone: string): string {
	const dateLabel = startsAt.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone,
	});
	const startLabel = startsAt.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
	});
	const endLabel = endsAt.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone,
		timeZoneName: "short",
	});
	return `${dateLabel}, ${startLabel} – ${endLabel}`;
}

/** UTC instant -> Google Calendar's YYYYMMDDTHHmmssZ template-link format. */
function toGoogleCalendarUtc(date: Date): string {
	return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

/**
 * A static "add to my calendar" link — no OAuth required, works for any
 * visitor regardless of whether they use Google Calendar day-to-day.
 */
export function buildGoogleCalendarAddLink(
	input: BookingEmailInput & { meetLink: string },
): string {
	const params = new URLSearchParams({
		action: "TEMPLATE",
		text: `Meeting with ${input.hostName}`,
		dates: `${toGoogleCalendarUtc(input.startsAt)}/${toGoogleCalendarUtc(input.endsAt)}`,
		details: `Join: ${input.meetLink}${input.note ? `\n\n${input.note}` : ""}`,
		location: input.meetLink,
	});
	return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildBookingConfirmationEmail(
	input: BookingEmailInput & { meetLink: string },
): { subject: string; html: string } {
	const when = formatWhen(input.startsAt, input.endsAt, input.timeZone);
	const addToCalendarUrl = buildGoogleCalendarAddLink(input);

	const subject = `Confirmed: your meeting with ${input.hostName}`;

	const html = `
		<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
			<h2 style="margin-bottom: 4px;">Your meeting is confirmed</h2>
			<p style="color: #555;">Hi ${escapeHtml(input.visitorName)}, ${escapeHtml(input.hostName)} has accepted your booking request.</p>
			<table style="width: 100%; margin: 20px 0; border-collapse: collapse;">
				<tr>
					<td style="padding: 6px 0; color: #555;">When</td>
					<td style="padding: 6px 0; font-weight: 600;">${escapeHtml(when)}</td>
				</tr>
				<tr>
					<td style="padding: 6px 0; color: #555;">Host</td>
					<td style="padding: 6px 0; font-weight: 600;">${escapeHtml(input.hostName)}</td>
				</tr>
				<tr>
					<td style="padding: 6px 0; color: #555;">Meeting link</td>
					<td style="padding: 6px 0;"><a href="${input.meetLink}">${input.meetLink}</a></td>
				</tr>
				${
					input.note
						? `<tr><td style="padding: 6px 0; color: #555; vertical-align: top;">Your note</td><td style="padding: 6px 0;">${escapeHtml(input.note)}</td></tr>`
						: ""
				}
			</table>
			<p>
				<a href="${addToCalendarUrl}" style="display: inline-block; background: #4F46E5; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">
					Add to Google Calendar
				</a>
			</p>
			<p>
				<a href="${input.meetLink}" style="display: inline-block; margin-top: 8px; color: #4F46E5; text-decoration: none;">
					Join with Google Meet →
				</a>
			</p>
		</div>
	`.trim();

	return { subject, html };
}

export function buildBookingDeclinedEmail(
	input: Pick<
		BookingEmailInput,
		"visitorName" | "hostName" | "startsAt" | "timeZone"
	>,
): { subject: string; html: string; text: string } {
	const dateLabel = input.startsAt.toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		timeZone: input.timeZone,
	});

	const subject = `${input.hostName} can't make your requested time`;
	const text = `Hi ${input.visitorName},\n\n${input.hostName} isn't able to meet on ${dateLabel}. Feel free to pick another time on their booking page.\n`;
	const html = `
		<div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; color: #111;">
			<h2 style="margin-bottom: 4px;">Your booking request wasn't accepted</h2>
			<p style="color: #555;">
				Hi ${escapeHtml(input.visitorName)}, ${escapeHtml(input.hostName)} isn't able to meet on
				<strong>${escapeHtml(dateLabel)}</strong>. Feel free to pick another time on their booking page.
			</p>
		</div>
	`.trim();

	return { subject, html, text };
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}
