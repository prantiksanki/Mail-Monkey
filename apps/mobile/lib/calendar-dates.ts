// Date math shared by the calendar views and the swipe navigation.
// All ranges are local-time and inclusive of the full end day.

export type CalendarView = "day" | "week" | "month" | "year";

export const GRID_CELLS = 42; // 6 rows x 7 cols — fixed so the grid never jumps

export function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function startOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

export function endOfDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(23, 59, 59, 999);
	return x;
}

/** Sunday on or before `d`. */
export function startOfWeek(d: Date): Date {
	const x = startOfDay(d);
	x.setDate(x.getDate() - x.getDay());
	return x;
}

export function endOfWeek(d: Date): Date {
	const x = startOfWeek(d);
	x.setDate(x.getDate() + 6);
	return endOfDay(x);
}

/** First cell of the month grid — the Sunday on or before the 1st. */
export function startOfMonthGrid(d: Date): Date {
	const first = new Date(d.getFullYear(), d.getMonth(), 1);
	return startOfWeek(first);
}

export function endOfMonthGrid(d: Date): Date {
	const start = startOfMonthGrid(d);
	const end = new Date(start);
	end.setDate(end.getDate() + GRID_CELLS - 1);
	return endOfDay(end);
}

export function startOfYear(d: Date): Date {
	return startOfDay(new Date(d.getFullYear(), 0, 1));
}

export function endOfYear(d: Date): Date {
	return endOfDay(new Date(d.getFullYear(), 11, 31));
}

/** The fetch window for a view — feeds api.calendar's timeMin/timeMax. */
export function rangeFor(
	view: CalendarView,
	anchor: Date,
): {
	start: Date;
	end: Date;
} {
	switch (view) {
		case "day":
			return { start: startOfDay(anchor), end: endOfDay(anchor) };
		case "week":
			return { start: startOfWeek(anchor), end: endOfWeek(anchor) };
		case "month":
			return {
				start: startOfMonthGrid(anchor),
				end: endOfMonthGrid(anchor),
			};
		case "year":
			return { start: startOfYear(anchor), end: endOfYear(anchor) };
	}
}

/** Step the anchor by one unit of the active view (swipe / arrows). */
export function stepDate(
	view: CalendarView,
	anchor: Date,
	delta: number,
): Date {
	const d = new Date(anchor);
	switch (view) {
		case "day":
			d.setDate(d.getDate() + delta);
			return d;
		case "week":
			d.setDate(d.getDate() + 7 * delta);
			return d;
		case "month":
			// Snap to the 1st first so month-length differences can't overflow
			// (e.g. Mar 31 -> Feb would roll into March).
			return new Date(d.getFullYear(), d.getMonth() + delta, 1);
		case "year":
			return new Date(d.getFullYear() + delta, d.getMonth(), 1);
	}
}

/** N consecutive days starting at `start`. */
export function daysFrom(start: Date, count: number): Date[] {
	return Array.from({ length: count }, (_, i) => {
		const d = new Date(start);
		d.setDate(d.getDate() + i);
		return d;
	});
}

export function fmtTime(iso?: string): string {
	if (!iso) return "";
	return new Date(iso).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

/** "20 September 2022" — the agenda group header from the design. */
export function fmtGroupHeader(d: Date): string {
	return d.toLocaleDateString(undefined, {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
}
