import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { CalendarEvent } from "@/lib/api";
import { fmtGroupHeader, isSameDay } from "@/lib/calendar-dates";
import { CAL, CAL_SIZES } from "@/lib/calendar-theme";
import { EventPill } from "./event-pill";

type Group = { key: string; date: Date; events: CalendarEvent[] };

/** Bucket events by day, ascending, dropping days with nothing on them. */
function groupByDay(events: CalendarEvent[], days: Date[]): Group[] {
	return days
		.map((date) => ({
			key: date.toISOString(),
			date,
			events: events
				.filter((ev) => ev.start && isSameDay(new Date(ev.start), date))
				.sort((a, b) => (a.start ?? "").localeCompare(b.start ?? "")),
		}))
		.filter((g) => g.events.length > 0);
}

export function AgendaList({
	events,
	days,
	emptyLabel = "Nothing scheduled",
}: {
	events: CalendarEvent[];
	/** Candidate days to show headers for (the visible range). */
	days: Date[];
	emptyLabel?: string;
}) {
	const groups = groupByDay(events, days);

	if (groups.length === 0) {
		return (
			<View style={styles.empty}>
				<Ionicons
					name="calendar-clear-outline"
					size={24}
					color="#c4c7cc"
				/>
				<Text style={styles.emptyText}>{emptyLabel}</Text>
			</View>
		);
	}

	return (
		<View style={styles.wrap}>
			{groups.map((g) => (
				<View key={g.key} style={styles.group}>
					<Text style={styles.header}>{fmtGroupHeader(g.date)}</Text>
					{g.events.map((ev) => (
						<View key={ev.id} style={styles.pillWrap}>
							{/* Timed events that aren't all-day get the priority dot */}
							<EventPill event={ev} important={!ev.isAllDay} />
						</View>
					))}
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { paddingTop: 20 },
	group: { marginBottom: 26 },
	header: {
		fontSize: CAL_SIZES.groupHeader,
		fontWeight: "300",
		color: CAL.text,
		marginLeft: 30,
		marginBottom: 14,
	},
	pillWrap: { paddingHorizontal: CAL_SIZES.pillMargin, marginBottom: 12 },
	empty: { alignItems: "center", gap: 8, paddingVertical: 48 },
	emptyText: { fontSize: 14, color: "#9aa0a6" },
});
