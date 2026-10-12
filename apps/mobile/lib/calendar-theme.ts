// Design tokens lifted from the "Clean Calendar app UI" Figma file
// (lKy7vOlHs3rb5wbzQhqVPE — frames 12:143 collapsed week, 7:3 expanded month).
// Every calendar component reads from here so the look stays consistent.

export const CAL = {
	panelBg: "#f4f4f4",
	screenBg: "#ffffff",
	border: "#bbbbbb",
	hairline: "#ececef",
	text: "#000000",
	// Weekday labels and out-of-month dates are the same muted ink.
	muted: "rgba(0,0,0,0.4)",
	faint: "rgba(0,0,0,0.25)",
	// Selected day = filled accent; today = accent outline (Figma 14:323).
	accent: "#3f15ea",
	accentText: "#ffffff",
	selectedChip: "#e0e0e0",
	todayChip: "#111111",
	todayText: "#ffffff",
} as const;

export const CAL_SIZES = {
	cell: 42, // date cell is 42x42
	pitch: 52, // ...spaced every 52px in the Figma (390px wide frame)
	cellRadius: 14,
	gutter: 18,
	pillHeight: 54,
	pillRadius: 20,
	pillMargin: 24,
	pillPadding: 20,
	monthTitle: 33,
	weekday: 16,
	dateText: 16,
	groupHeader: 20,
	dot: 6,
} as const;

// Pastel background + saturated text, straight from the Figma event pills.
export type PillColor = { bg: string; fg: string };

export const PILL_COLORS: PillColor[] = [
	{ bg: "#bdd0fc", fg: "#3f15ea" }, // blue
	{ bg: "#fcc8bd", fg: "#ea1515" }, // salmon
	{ bg: "#fcbdf2", fg: "#ea15bb" }, // pink
];

export const ALL_DAY_COLOR: PillColor = PILL_COLORS[0];

// Google events carry no category, so derive a stable color from the id —
// the same event always gets the same color instead of flickering on re-render.
export function pillColorFor(id: string, isAllDay?: boolean): PillColor {
	if (isAllDay) {
		return ALL_DAY_COLOR;
	}
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
	}
	return PILL_COLORS[hash % PILL_COLORS.length];
}

export const WEEKDAYS_SHORT = [
	"SUN",
	"MON",
	"TUE",
	"WED",
	"THU",
	"FRI",
	"SAT",
] as const;

export const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

export const MONTHS_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;
