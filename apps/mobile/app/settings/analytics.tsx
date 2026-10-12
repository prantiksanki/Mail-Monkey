import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { EmailVolumeChart } from "@/components/email-volume-chart";
import {
	type AnalyticsOverview,
	api,
	type TopSender,
	type VolumePoint,
} from "@/lib/api";

// Status colors are reserved for state and never reused as series colors.
function rateStatus(rate: number): { color: string; label: string } {
	if (rate >= 0.9) {
		return { color: "#22a06b", label: "Healthy" };
	}
	if (rate >= 0.7) {
		return { color: "#b45309", label: "Fair" };
	}
	return { color: "#dc2626", label: "Low" };
}

function StatTile({
	icon,
	label,
	value,
	sub,
	subColor,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	value: string;
	sub?: string;
	subColor?: string;
}) {
	return (
		<View style={styles.tile}>
			<View style={styles.tileHead}>
				<Text style={styles.tileLabel}>{label}</Text>
				<Ionicons name={icon} size={14} color="#9aa0a6" />
			</View>
			<Text style={styles.tileValue}>{value}</Text>
			{sub ? (
				<Text
					style={[
						styles.tileSub,
						subColor ? { color: subColor } : null,
					]}
				>
					{sub}
				</Text>
			) : null}
		</View>
	);
}

export default function AnalyticsScreen() {
	const [overview, setOverview] = useState<AnalyticsOverview | null>(null);
	const [volume, setVolume] = useState<VolumePoint[]>([]);
	const [senders, setSenders] = useState<TopSender[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(async () => {
		setError(null);
		// The backend's DB (Neon, us-east-2) cold-starts after idle and can
		// drop a connection mid-query, surfacing as a transient 500. Retry the
		// batch a few times so a blip recovers instead of erroring the screen.
		const attempts = 3;
		let lastErr: unknown;
		for (let i = 0; i < attempts; i++) {
			try {
				const [ov, vol, top] = await Promise.all([
					api.getAnalyticsOverview(),
					api.getEmailVolume(30),
					api.getTopSenders(10),
				]);
				setOverview(ov);
				setVolume(vol?.volume ?? []);
				setSenders(top?.senders ?? []);
				setLoading(false);
				setRefreshing(false);
				return;
			} catch (e) {
				lastErr = e;
				if (i < attempts - 1) {
					await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
				}
			}
		}
		setError(
			lastErr instanceof Error
				? lastErr.message
				: "Failed to load analytics",
		);
		setLoading(false);
		setRefreshing(false);
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const onRefresh = () => {
		setRefreshing(true);
		load();
	};

	if (loading) {
		return (
			<>
				<Stack.Screen options={{ title: "Analytics" }} />
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#141718" />
				</View>
			</>
		);
	}

	if (error) {
		return (
			<>
				<Stack.Screen options={{ title: "Analytics" }} />
				<View style={styles.center}>
					<Text style={styles.muted}>{error}</Text>
				</View>
			</>
		);
	}

	const hasData =
		!!overview &&
		(overview.totalEmailsProcessed > 0 || overview.activeRules.total > 0);

	if (!hasData) {
		return (
			<>
				<Stack.Screen options={{ title: "Analytics" }} />
				<View style={styles.center}>
					<Ionicons
						name="bar-chart-outline"
						size={28}
						color="#c4c7cc"
					/>
					<Text style={styles.muted}>
						No analytics yet. Once rules start processing mail, it
						shows up here.
					</Text>
				</View>
			</>
		);
	}

	const rate = overview.automationSuccessRate;
	const status = rateStatus(rate.rate);
	const maxCount = senders.length > 0 ? senders[0].count : 1;

	return (
		<>
			<Stack.Screen options={{ title: "Analytics" }} />
			<ScrollView
				style={styles.container}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={onRefresh}
					/>
				}
			>
				<View style={styles.tiles}>
					<StatTile
						icon="mail-outline"
						label="Emails processed"
						value={overview.totalEmailsProcessed.toLocaleString()}
						sub="all time"
					/>
					<StatTile
						icon="checkmark-circle-outline"
						label="Automation success"
						value={
							rate.total > 0
								? `${Math.round(rate.rate * 100)}%`
								: "—"
						}
						sub={
							rate.total > 0
								? `${status.label} · ${rate.matched}/${rate.total}`
								: undefined
						}
						subColor={rate.total > 0 ? status.color : undefined}
					/>
					<StatTile
						icon="flash-outline"
						label="Active rules"
						value={String(overview.activeRules.active)}
						sub={`of ${overview.activeRules.total} total`}
					/>
				</View>

				{rate.errors > 0 ? (
					<View style={styles.errorBar}>
						<Ionicons
							name="alert-circle-outline"
							size={15}
							color="#dc2626"
						/>
						<Text style={styles.errorBarText}>
							{rate.errors} rule{" "}
							{rate.errors === 1 ? "error" : "errors"} in this
							period
						</Text>
					</View>
				) : null}

				<View style={styles.card}>
					<Text style={styles.cardTitle}>Email volume</Text>
					<Text style={styles.cardSub}>
						Processed over the last 30 days
					</Text>
					<View style={{ marginTop: 12 }}>
						<EmailVolumeChart data={volume} />
					</View>
				</View>

				{senders.length > 0 ? (
					<View style={styles.card}>
						<Text style={styles.cardTitle}>Top senders</Text>
						<View style={{ marginTop: 10 }}>
							{senders.map((s, i) => (
								<View key={s.sender} style={styles.senderRow}>
									<Text style={styles.rank}>{i + 1}</Text>
									<View style={styles.senderBody}>
										<Text
											style={styles.senderName}
											numberOfLines={1}
										>
											{s.sender}
										</Text>
										<View style={styles.barTrack}>
											<View
												style={[
													styles.barFill,
													{
														width: `${Math.max(
															(s.count /
																maxCount) *
																100,
															4,
														)}%`,
													},
												]}
											/>
										</View>
									</View>
									<Text style={styles.senderCount}>
										{s.count}
									</Text>
								</View>
							))}
						</View>
					</View>
				) : null}

				<View style={{ height: 28 }} />
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		gap: 10,
		padding: 24,
		backgroundColor: "#f7f8fa",
	},
	muted: { color: "#6b7280", fontSize: 14, textAlign: "center" },
	tiles: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 10,
		marginHorizontal: 12,
		marginTop: 12,
	},
	tile: {
		flexGrow: 1,
		flexBasis: "47%",
		backgroundColor: "#fff",
		borderRadius: 16,
		padding: 14,
	},
	tileHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	tileLabel: { fontSize: 12, color: "#6b7280", fontWeight: "600", flex: 1 },
	tileValue: { fontSize: 24, fontWeight: "700", color: "#111", marginTop: 6 },
	tileSub: { fontSize: 11, color: "#9aa0a6", marginTop: 2 },
	errorBar: {
		flexDirection: "row",
		alignItems: "center",
		gap: 7,
		backgroundColor: "#fef2f2",
		marginHorizontal: 12,
		marginTop: 10,
		padding: 11,
		borderRadius: 12,
	},
	errorBarText: { fontSize: 13, color: "#dc2626", flex: 1 },
	card: {
		backgroundColor: "#fff",
		marginHorizontal: 12,
		marginTop: 12,
		borderRadius: 16,
		padding: 16,
	},
	cardTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
	cardSub: { fontSize: 12, color: "#9aa0a6", marginTop: 2 },
	senderRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 8,
	},
	rank: { fontSize: 12, color: "#c4c7cc", fontWeight: "700", width: 16 },
	senderBody: { flex: 1, gap: 5 },
	senderName: { fontSize: 13, color: "#111" },
	barTrack: {
		height: 6,
		backgroundColor: "#f1f3f5",
		borderRadius: 999,
		overflow: "hidden",
	},
	barFill: { height: 6, backgroundColor: "#141718", borderRadius: 999 },
	senderCount: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
});
