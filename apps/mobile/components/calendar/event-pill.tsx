import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { CalendarEvent } from "@/lib/api";
import { fmtTime } from "@/lib/calendar-dates";
import { CAL_SIZES, pillColorFor } from "@/lib/calendar-theme";

// The Figma uses SF Symbols (iOS-only). Map to the Ionicons the app already
// ships, picked from keywords in the event title so pills feel specific.
function iconFor(
	summary: string | undefined,
	isAllDay: boolean | undefined,
): keyof typeof Ionicons.glyphMap {
	const s = (summary ?? "").toLowerCase();
	if (/birthday|bday|anniversar/.test(s)) {
		return "balloon-outline";
	}
	if (/meet|standup|stand-up|sync|call|1:1|interview/.test(s)) {
		return "people-outline";
	}
	if (/play|theat|movie|concert|show|gig/.test(s)) {
		return "musical-notes-outline";
	}
	if (/flight|travel|trip|train/.test(s)) {
		return "airplane-outline";
	}
	if (/deadline|due|submit/.test(s)) {
		return "flag-outline";
	}
	if (/lunch|dinner|breakfast|coffee/.test(s)) {
		return "restaurant-outline";
	}
	if (/class|lesson|study|exam/.test(s)) {
		return "school-outline";
	}
	return isAllDay ? "calendar-outline" : "time-outline";
}

/** Right-hand label: "All day", "19h", or "15h30 - 17h00" as in the design. */
function timeLabel(ev: CalendarEvent): string {
	if (ev.isAllDay) {
		return "All day";
	}
	const start = fmtTime(ev.start);
	if (!start) {
		return "";
	}
	const end = fmtTime(ev.end);
	return end && end !== start ? `${start} - ${end}` : start;
}

export function EventPill({
	event,
	important,
	onPress,
}: {
	event: CalendarEvent;
	important?: boolean;
	onPress?: () => void;
}) {
	const { bg, fg } = pillColorFor(event.id, event.isAllDay);
	const icon = iconFor(event.summary, event.isAllDay);

	return (
		<View style={styles.row}>
			<Pressable
				style={[styles.pill, { backgroundColor: bg }]}
				onPress={onPress}
				disabled={!onPress}
			>
				<Ionicons
					name={icon}
					size={17}
					color={fg}
					style={styles.icon}
				/>
				<Text style={[styles.title, { color: fg }]} numberOfLines={1}>
					{event.summary ?? "Untitled event"}
				</Text>
				<Text style={[styles.time, { color: fg }]} numberOfLines={1}>
					{timeLabel(event)}
				</Text>
			</Pressable>
			{/* 6px "important" dot sits outside the pill on the right */}
			<View style={styles.dotSlot}>
				{important ? <View style={styles.dot} /> : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: "row", alignItems: "center" },
	pill: {
		flex: 1,
		height: CAL_SIZES.pillHeight,
		borderRadius: CAL_SIZES.pillRadius,
		paddingHorizontal: CAL_SIZES.pillPadding,
		flexDirection: "row",
		alignItems: "center",
	},
	icon: { marginRight: 8 },
	title: { flex: 1, fontSize: 16, fontWeight: "400" },
	time: { fontSize: 16, fontWeight: "400", marginLeft: 10 },
	dotSlot: { width: 15, alignItems: "center" },
	dot: {
		width: CAL_SIZES.dot,
		height: CAL_SIZES.dot,
		borderRadius: CAL_SIZES.dot / 2,
		backgroundColor: "#ea1515",
	},
});
