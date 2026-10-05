import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	interpolate,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { AgendaList } from "@/components/calendar/agenda-list";
import { api, type CalendarEvent } from "@/lib/api";
import {
	daysFrom,
	GRID_CELLS,
	isSameDay,
	rangeFor,
	startOfDay,
	startOfMonthGrid,
	stepDate,
} from "@/lib/calendar-dates";
import { CAL, CAL_SIZES, MONTHS, WEEKDAYS_SHORT } from "@/lib/calendar-theme";

const ROW_H = 48; // one week row
const WEEKS = GRID_CELLS / 7; // 6
const MONTH_H = WEEKS * ROW_H;
const WEEK_H = ROW_H;

// ---- sample data (Google Calendar not connected yet; real events win) ----
const SHOW_DUMMY_EVENTS = true;
const SAMPLES = [
	{ summary: "Morning standup", hour: 9, dur: 0.5 },
	{ summary: "Design review", hour: 14.5, dur: 1 },
	{ summary: "John's Birthday", hour: 0, dur: 0, allDay: true },
	{ summary: "Romeo and Juliet play", hour: 19, dur: 2 },
	{ summary: "Meeting", hour: 15.5, dur: 1.5 },
	{ summary: "Guitar class", hour: 17, dur: 1 },
];
function dummyEventsForRange(start: Date, end: Date): CalendarEvent[] {
	const out: CalendarEvent[] = [];
	const cursor = new Date(startOfDay(start));
	let n = 0;
	while (cursor <= end) {
		const seed = cursor.getDate() + cursor.getMonth() * 31;
		if (seed % 3 === 0 || seed % 7 === 0) {
			const s = SAMPLES[seed % SAMPLES.length];
			const st = new Date(cursor);
			st.setHours(Math.floor(s.hour), (s.hour % 1) * 60, 0, 0);
			const en = new Date(st);
			en.setMinutes(en.getMinutes() + s.dur * 60);
			out.push({
				id: `dz-${st.toISOString()}-${n}`,
				summary: s.summary,
				start: st.toISOString(),
				end: s.allDay ? undefined : en.toISOString(),
				isAllDay: s.allDay,
			});
			n++;
		}
		cursor.setDate(cursor.getDate() + 1);
	}
	return out;
}

type CalendarState = {
	events: CalendarEvent[];
	needsReconnect: boolean;
	serviceDisabled: boolean;
};
function normalize(
	res: Awaited<ReturnType<typeof api.calendar>>,
): CalendarState {
	if (Array.isArray(res)) {
		return { events: res, needsReconnect: false, serviceDisabled: false };
	}
	return {
		events: res?.events ?? [],
		needsReconnect: !!res?.needsReconnect,
		serviceDisabled: !!res?.serviceDisabled,
	};
}

export default function CalendarScreen() {
	const today = useMemo(() => new Date(), []);
	const [anchor, setAnchor] = useState<Date>(today);
	const [selected, setSelected] = useState<Date>(today);

	const [state, setState] = useState<CalendarState>({
		events: [],
		needsReconnect: false,
		serviceDisabled: false,
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Always fetch the full month grid window (covers both month & week views).
	const { start, end } = useMemo(() => rangeFor("month", anchor), [anchor]);
	const timeMin = start.toISOString();
	const timeMax = end.toISOString();

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const mailboxes = await api.getMailboxes();
			const google = mailboxes.find((m) => m.provider === "GOOGLE");
			if (!google) {
				setError("Calendar needs a connected Google account.");
				return;
			}
			setState(
				normalize(await api.calendar(google.id, { timeMin, timeMax })),
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to load calendar");
		} finally {
			setLoading(false);
		}
	}, [timeMin, timeMax]);

	useEffect(() => {
		load();
	}, [load]);

	const events = useMemo(() => {
		if (state.events.length > 0) return state.events;
		if (SHOW_DUMMY_EVENTS) return dummyEventsForRange(start, end);
		return [];
	}, [state.events, start, end]);
	const usingDummy = state.events.length === 0 && SHOW_DUMMY_EVENTS;

	const gridStart = useMemo(() => startOfMonthGrid(anchor), [anchor]);
	const days = useMemo(() => daysFrom(gridStart, GRID_CELLS), [gridStart]);
	const month = anchor.getMonth();

	// Row (week) of the selected day; used to keep it visible when collapsed.
	const weekIndex = useMemo(() => {
		const i = days.findIndex((d) => isSameDay(d, selected));
		return i >= 0 ? Math.floor(i / 7) : 0;
	}, [days, selected]);

	// progress: 0 = full month, 1 = single week. Driven by vertical drag.
	const progress = useSharedValue(0);
	const startProgress = useSharedValue(0);

	const pan = useMemo(
		() =>
			Gesture.Pan()
				.activeOffsetY([-12, 12])
				.onStart(() => {
					startProgress.value = progress.value;
				})
				.onUpdate((e) => {
					// drag up (negative translationY) → collapse toward week
					const delta = -e.translationY / (MONTH_H - WEEK_H);
					let p = startProgress.value + delta;
					if (p < 0) p = 0;
					if (p > 1) p = 1;
					progress.value = p;
				})
				.onEnd((e) => {
					const snap = progress.value > 0.5 || e.velocityY < -600 ? 1 : 0;
					if (e.velocityY > 600) {
						progress.value = withTiming(0);
					} else {
						progress.value = withTiming(snap);
					}
				}),
		[progress, startProgress],
	);

	const gridClipStyle = useAnimatedStyle(() => ({
		height: interpolate(progress.value, [0, 1], [MONTH_H, WEEK_H]),
	}));
	const gridInnerStyle = useAnimatedStyle(() => ({
		transform: [
			{
				translateY: interpolate(
					progress.value,
					[0, 1],
					[0, -weekIndex * ROW_H],
				),
			},
		],
	}));

	const go = useCallback(
		(delta: number) => {
			setAnchor((a) => stepDate("month", a, delta));
			Haptics.selectionAsync().catch(() => {});
		},
		[],
	);

	const goToToday = () => {
		setAnchor(today);
		setSelected(today);
	};

	const rows = useMemo(() => {
		const out: Date[][] = [];
		for (let r = 0; r < WEEKS; r++) out.push(days.slice(r * 7, r * 7 + 7));
		return out;
	}, [days]);

	return (
		<View style={styles.screen}>
			{/* ---- header ---- */}
			<View style={styles.header}>
				<Text style={styles.title}>
					{MONTHS[month]}, {anchor.getFullYear()}
				</Text>
				<Pressable onPress={goToToday} hitSlop={8}>
					<Text style={styles.todayLink}>Today</Text>
				</Pressable>
				<Pressable onPress={() => go(-1)} hitSlop={8} style={styles.arrow}>
					<Ionicons name="chevron-back" size={20} color="#111" />
				</Pressable>
				<Pressable onPress={() => go(1)} hitSlop={8} style={styles.arrow}>
					<Ionicons name="chevron-forward" size={20} color="#111" />
				</Pressable>
			</View>

			{/* ---- calendar panel (collapsible) ---- */}
			<GestureDetector gesture={pan}>
				<View style={styles.panel}>
					<View style={styles.weekRow}>
						{WEEKDAYS_SHORT.map((w) => (
							<View key={w} style={styles.slot}>
								<Text style={styles.weekday}>{w}</Text>
							</View>
						))}
					</View>

					{loading ? (
						<View style={{ height: MONTH_H, justifyContent: "center" }}>
							<ActivityIndicator color={CAL.accent} />
						</View>
					) : (
						<Animated.View style={[styles.gridClip, gridClipStyle]}>
							<Animated.View style={gridInnerStyle}>
								{rows.map((week, ri) => (
									<View key={ri} style={styles.gridRow}>
										{week.map((d) => {
											const inMonth = d.getMonth() === month;
											const sel = isSameDay(d, selected);
											const tod = !sel && isSameDay(d, today);
											const has = events.some(
												(ev) =>
													ev.start &&
													isSameDay(new Date(ev.start), d),
											);
											return (
												<View key={d.toISOString()} style={styles.slot}>
													<Pressable
														style={[
															styles.cell,
															sel && styles.cellSel,
															tod && styles.cellTod,
														]}
														onPress={() => setSelected(new Date(d))}
													>
														<Text
															style={[
																styles.date,
																!inMonth && styles.dateOut,
																sel && styles.dateSel,
																tod && styles.dateTod,
															]}
														>
															{d.getDate()}
														</Text>
													</Pressable>
													<View style={styles.dotSlot}>
														{has && !sel ? (
															<View style={styles.dot} />
														) : null}
													</View>
												</View>
											);
										})}
									</View>
								))}
							</Animated.View>
						</Animated.View>
					)}

					{/* grabber — drag to collapse/expand */}
					<View style={styles.grabber} />
				</View>
			</GestureDetector>

			{usingDummy ? (
				<View style={styles.notice}>
					<Ionicons name="flask-outline" size={14} color="#6b7280" />
					<Text style={styles.noticeText}>
						Sample events — connect Google Calendar for your schedule.
					</Text>
				</View>
			) : error ? (
				<View style={styles.notice}>
					<Ionicons name="calendar-outline" size={14} color="#6b7280" />
					<Text style={styles.noticeText}>{error}</Text>
				</View>
			) : null}

			{/* ---- events (independently scrollable) ---- */}
			<ScrollView
				style={styles.events}
				contentContainerStyle={{ paddingBottom: 28 }}
				showsVerticalScrollIndicator={false}
			>
				<AgendaList
					events={events}
					days={days}
					emptyLabel="No events this month"
				/>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: CAL.screenBg },
	header: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingHorizontal: CAL_SIZES.gutter,
		paddingTop: 12,
		paddingBottom: 8,
	},
	title: {
		flex: 1,
		fontSize: CAL_SIZES.monthTitle,
		fontWeight: "500",
		color: CAL.text,
	},
	todayLink: { fontSize: 15, color: CAL.accent, fontWeight: "500" },
	arrow: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
	panel: {
		backgroundColor: CAL.panelBg,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: CAL.border,
		paddingHorizontal: CAL_SIZES.gutter,
		paddingTop: 4,
		paddingBottom: 6,
	},
	weekRow: { flexDirection: "row" },
	slot: { width: `${100 / 7}%`, alignItems: "center" },
	weekday: {
		fontSize: CAL_SIZES.weekday,
		color: CAL.muted,
		fontWeight: "300",
		paddingVertical: 8,
	},
	gridClip: { overflow: "hidden" },
	gridRow: { flexDirection: "row", height: ROW_H, alignItems: "flex-start" },
	cell: {
		width: CAL_SIZES.cell,
		height: CAL_SIZES.cell,
		borderRadius: CAL_SIZES.cellRadius,
		alignItems: "center",
		justifyContent: "center",
	},
	cellSel: { backgroundColor: CAL.accent },
	cellTod: { borderWidth: 1, borderColor: CAL.accent },
	date: { fontSize: CAL_SIZES.dateText, color: CAL.text, fontWeight: "300" },
	dateOut: { color: CAL.faint },
	dateSel: { color: CAL.accentText, fontWeight: "500" },
	dateTod: { color: CAL.accent, fontWeight: "500" },
	dotSlot: { height: 6, justifyContent: "center" },
	dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: CAL.accent },
	grabber: {
		alignSelf: "center",
		width: 64,
		height: 4,
		borderRadius: 2,
		backgroundColor: "#c4c7cc",
		marginTop: 8,
		marginBottom: 2,
	},
	notice: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "#fff7ed",
		marginHorizontal: CAL_SIZES.pillMargin,
		marginTop: 12,
		padding: 10,
		borderRadius: 12,
	},
	noticeText: { flex: 1, fontSize: 12.5, color: "#6b7280" },
	events: { flex: 1 },
});
