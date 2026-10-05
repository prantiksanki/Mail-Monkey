import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarEvent } from "@/lib/api";
import { isSameDay, startOfWeek } from "@/lib/calendar-dates";
import { CAL, MONTHS_SHORT } from "@/lib/calendar-theme";

// Not in the Figma — extrapolated in the same visual language: 12 mini month
// matrices, muted ink, a chip on today, and a dot under months that have events.

function miniCells(year: number, month: number): (number | null)[] {
	const first = new Date(year, month, 1);
	const lead = startOfWeek(first);
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const offset = Math.round(
		(first.getTime() - lead.getTime()) / (24 * 60 * 60 * 1000),
	);
	const cells: (number | null)[] = Array(offset).fill(null);
	for (let d = 1; d <= daysInMonth; d++) cells.push(d);
	while (cells.length % 7 !== 0) cells.push(null);
	return cells;
}

export function YearGrid({
	year,
	today,
	events,
	onSelectMonth,
}: {
	year: number;
	today: Date;
	events: CalendarEvent[];
	onSelectMonth: (month: number) => void;
}) {
	// Which months have at least one event — drives the dot under the name.
	const monthsWithEvents = new Set<number>();
	for (const ev of events) {
		if (!ev.start) continue;
		const d = new Date(ev.start);
		if (d.getFullYear() === year) monthsWithEvents.add(d.getMonth());
	}

	return (
		<View style={styles.wrap}>
			{MONTHS_SHORT.map((name, month) => {
				const cells = miniCells(year, month);
				const isCurrentMonth =
					today.getFullYear() === year && today.getMonth() === month;
				return (
					<Pressable
						key={name}
						style={styles.month}
						onPress={() => onSelectMonth(month)}
					>
						<View style={styles.nameRow}>
							<Text
								style={[
									styles.name,
									isCurrentMonth && styles.nameCurrent,
								]}
							>
								{name}
							</Text>
							{monthsWithEvents.has(month) ? (
								<View style={styles.dot} />
							) : null}
						</View>
						<View style={styles.cells}>
							{cells.map((day, i) => {
								const isToday =
									day !== null &&
									isSameDay(
										new Date(year, month, day),
										today,
									);
								return (
									<View
										key={`${name}-${i}`}
										style={styles.cellSlot}
									>
										{day === null ? null : (
											<View
												style={[
													styles.cell,
													isToday && styles.cellToday,
												]}
											>
												<Text
													style={[
														styles.day,
														isToday &&
															styles.dayToday,
													]}
												>
													{day}
												</Text>
											</View>
										)}
									</View>
								);
							})}
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		flexDirection: "row",
		flexWrap: "wrap",
		paddingHorizontal: 12,
		paddingTop: 6,
	},
	month: { width: "33.333%", paddingHorizontal: 6, marginBottom: 20 },
	nameRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		marginBottom: 6,
	},
	name: { fontSize: 15, fontWeight: "500", color: CAL.text },
	nameCurrent: { color: "#3f15ea" },
	dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#3f15ea" },
	cells: { flexDirection: "row", flexWrap: "wrap" },
	cellSlot: {
		width: `${100 / 7}%`,
		aspectRatio: 1,
		alignItems: "center",
		justifyContent: "center",
	},
	cell: {
		width: 15,
		height: 15,
		borderRadius: 4,
		alignItems: "center",
		justifyContent: "center",
	},
	cellToday: { backgroundColor: CAL.todayChip },
	day: { fontSize: 9, color: CAL.muted },
	dayToday: { color: CAL.todayText, fontWeight: "600" },
});
