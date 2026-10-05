import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarEvent } from "@/lib/api";
import {
	daysFrom,
	GRID_CELLS,
	isSameDay,
	startOfMonthGrid,
} from "@/lib/calendar-dates";
import { CAL, CAL_SIZES, WEEKDAYS_SHORT } from "@/lib/calendar-theme";

// 6x7 month grid — Figma 14:323. Selected day = filled accent square, today =
// accent outline. A small dot under a date marks that it has events.
export function MonthGrid({
	anchor,
	selected,
	today,
	events,
	onSelect,
}: {
	anchor: Date;
	selected: Date;
	today: Date;
	events: CalendarEvent[];
	onSelect: (d: Date) => void;
}) {
	const days = daysFrom(startOfMonthGrid(anchor), GRID_CELLS);
	const month = anchor.getMonth();

	return (
		<View>
			<View style={styles.row}>
				{WEEKDAYS_SHORT.map((w) => (
					<View key={w} style={styles.slot}>
						<Text style={styles.weekday}>{w}</Text>
					</View>
				))}
			</View>
			<View style={styles.grid}>
				{days.map((d) => {
					const inMonth = d.getMonth() === month;
					const isSelected = isSameDay(d, selected);
					const isToday = !isSelected && isSameDay(d, today);
					const hasEvents = events.some(
						(ev) => ev.start && isSameDay(new Date(ev.start), d),
					);
					return (
						<View key={d.toISOString()} style={styles.slot}>
							<Pressable
								style={[
									styles.cell,
									isSelected && styles.cellSelected,
									isToday && styles.cellToday,
								]}
								onPress={() => onSelect(d)}
							>
								<Text
									style={[
										styles.date,
										!inMonth && styles.dateOut,
										isSelected && styles.dateSelected,
										isToday && styles.dateToday,
									]}
								>
									{d.getDate()}
								</Text>
							</Pressable>
							<View style={styles.dotSlot}>
								{hasEvents && !isSelected ? (
									<View style={styles.dot} />
								) : null}
							</View>
						</View>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row" },
	grid: { flexDirection: "row", flexWrap: "wrap" },
	slot: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 3 },
	weekday: {
		fontSize: CAL_SIZES.weekday,
		color: CAL.muted,
		fontWeight: "300",
		paddingVertical: 10,
	},
	cell: {
		width: CAL_SIZES.cell,
		height: CAL_SIZES.cell,
		borderRadius: CAL_SIZES.cellRadius,
		alignItems: "center",
		justifyContent: "center",
	},
	cellSelected: { backgroundColor: CAL.accent },
	cellToday: { borderWidth: 1, borderColor: CAL.accent },
	date: { fontSize: CAL_SIZES.dateText, color: CAL.text, fontWeight: "300" },
	dateOut: { color: CAL.faint },
	dateSelected: { color: CAL.accentText, fontWeight: "500" },
	dateToday: { color: CAL.accent, fontWeight: "500" },
	dotSlot: { height: 8, justifyContent: "center" },
	dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: CAL.accent },
});
