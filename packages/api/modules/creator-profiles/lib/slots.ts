// Computes open booking slots from a creator's weekly availability windows,
// minus already-booked time — all resolved against the creator's IANA
// timezone using Intl (no extra date library needed).

interface WeeklyWindow {
	dayOfWeek: number; // 0 (Sunday) .. 6 (Saturday)
	startTime: string; // "HH:mm"
	endTime: string; // "HH:mm"
}

interface BookedRange {
	startsAt: Date;
	endsAt: Date;
}

export interface OpenSlot {
	startsAt: Date;
	endsAt: Date;
}

/**
 * Resolves a wall-clock "HH:mm on a given UTC calendar date, as observed in
 * `timeZone`" to the actual UTC instant. Works for any IANA zone/DST offset
 * by asking Intl what offset applies on that date, then correcting for it.
 */
function zonedTimeToUtc(
	year: number,
	month: number, // 1-12
	day: number,
	hours: number,
	minutes: number,
	timeZone: string,
): Date {
	// First guess: treat the wall-clock time as if it were UTC.
	const guess = new Date(Date.UTC(year, month - 1, day, hours, minutes));

	const dtf = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hourCycle: "h23",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});

	const parts = Object.fromEntries(
		dtf.formatToParts(guess).map((p) => [p.type, p.value]),
	);
	const asObservedInZone = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second),
	);

	// Offset between what we asked for (guess, in UTC) and what that instant
	// actually reads as in `timeZone`. Subtract it to land on the right instant.
	const offsetMs = asObservedInZone - guess.getTime();
	return new Date(guess.getTime() - offsetMs);
}

function parseHm(value: string): { hours: number; minutes: number } {
	const [h, m] = value.split(":").map(Number);
	return { hours: h, minutes: m };
}

function getDayOfWeekInZone(date: Date, timeZone: string): number {
	const weekday = new Intl.DateTimeFormat("en-US", {
		timeZone,
		weekday: "short",
	}).format(date);
	return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
}

function getDatePartsInZone(
	date: Date,
	timeZone: string,
): { year: number; month: number; day: number } {
	const parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		})
			.formatToParts(date)
			.map((p) => [p.type, p.value]),
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
	};
}

/**
 * Open slots between `from` and `to` (both instants), `meetingLengthMinutes`
 * apart, that fall inside the creator's weekly windows and don't overlap an
 * existing booking. Slots that have already started relative to `now` are
 * excluded.
 */
export function computeOpenSlots({
	windows,
	booked,
	timeZone,
	meetingLengthMinutes,
	from,
	to,
	now = new Date(),
}: {
	windows: WeeklyWindow[];
	booked: BookedRange[];
	timeZone: string;
	meetingLengthMinutes: number;
	from: Date;
	to: Date;
	now?: Date;
}): OpenSlot[] {
	if (windows.length === 0 || meetingLengthMinutes <= 0) {
		return [];
	}

	const slots: OpenSlot[] = [];
	const stepMs = meetingLengthMinutes * 60_000;

	const cursor = new Date(from);
	// Walk day by day (in the creator's zone) from `from` to `to`.
	while (cursor <= to) {
		const { year, month, day } = getDatePartsInZone(cursor, timeZone);
		const dayOfWeek = getDayOfWeekInZone(cursor, timeZone);

		const todaysWindows = windows.filter((w) => w.dayOfWeek === dayOfWeek);

		for (const window of todaysWindows) {
			const start = parseHm(window.startTime);
			const end = parseHm(window.endTime);

			const windowStart = zonedTimeToUtc(
				year,
				month,
				day,
				start.hours,
				start.minutes,
				timeZone,
			);
			const windowEnd = zonedTimeToUtc(
				year,
				month,
				day,
				end.hours,
				end.minutes,
				timeZone,
			);

			for (
				let slotStart = windowStart;
				slotStart.getTime() + stepMs <= windowEnd.getTime();
				slotStart = new Date(slotStart.getTime() + stepMs)
			) {
				const slotEnd = new Date(slotStart.getTime() + stepMs);

				if (slotStart < from || slotEnd > to || slotStart < now) {
					continue;
				}

				const overlapsBooking = booked.some(
					(b) => slotStart < b.endsAt && slotEnd > b.startsAt,
				);
				if (overlapsBooking) {
					continue;
				}

				slots.push({ startsAt: slotStart, endsAt: slotEnd });
			}
		}

		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return slots.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
