import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarEvent } from "@/lib/api";
import { isSameDay } from "@/lib/calendar-dates";
import { CAL, CAL_SIZES, WEEKDAYS_SHORT } from "@/lib/calendar-theme";

/** One row: weekday labels above a row of date cells (Figma frame 12:143). */
export function WeekStrip({
	days,
	selected,
	today,
	events,
	onSelect,
}: {
	days: Date[];
	selected: Date;
	today: Date;
	events: CalendarEvent[];
	onSelect: (d: Date) => void;
}) {
	return (
		<View>
			<View style={styles.row}>
				{WEEKDAYS_SHORT.map((w) => (
					<View key={w} style={styles.cellSlot}>
						<Text style={styles.weekday}>{w}</Text>
					</View>
				))}
			</View>
			<View style={styles.row}>
				{days.map((d) => {
					const isSelected = isSameDay(d, selected);
					const isToday = isSameDay(d, today);
					const has = events.some(
						(ev) => ev.start && isSameDay(new Date(ev.start), d),
					);
					return (
						<View key={d.toISOString()} style={styles.cellSlot}>
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
										isToday && styles.dateToday,
									]}
								>
									{d.getDate()}
								</Text>
							</Pressable>
							<View style={styles.dotSlot}>
								{has ? <View style={styles.dot} /> : null}
							</View>
						</View>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", justifyContent: "space-between" },
	cellSlot: { alignItems: "center", width: `${100 / 7}%` },
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
	cellSelected: { backgroundColor: CAL.selectedChip },
	cellToday: { backgroundColor: CAL.todayChip },
	date: { fontSize: CAL_SIZES.dateText, color: CAL.text, fontWeight: "300" },
	dateToday: { color: CAL.todayText, fontWeight: "500" },
	dotSlot: { height: 10, justifyContent: "center" },
	dot: {
		width: 5,
		height: 5,
		borderRadius: 3,
		backgroundColor: "#3f15ea",
	},
});
