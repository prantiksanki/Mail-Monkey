import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { api, type TaskItem } from "@/lib/api";
import { getPaymentApps, UPI_APPS, type UpiApp } from "@/lib/payments";

export default function SmartTasksScreen() {
	const router = useRouter();
	const [mailboxId, setMailboxId] = useState<string | null>(null);
	const [items, setItems] = useState<TaskItem[]>([]);
	const [connected, setConnected] = useState<UpiApp[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);

	const load = useCallback(async () => {
		try {
			const mbs = await api.getMailboxes();
			if (!mbs[0]) {
				setLoading(false);
				return;
			}
			setMailboxId(mbs[0].id);
			const [tasks, apps] = await Promise.all([
				api.getMailboxTasks(mbs[0].id),
				getPaymentApps(),
			]);
			setItems(tasks.items);
			setConnected(apps);
		} catch {
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await load();
		setRefreshing(false);
	}, [load]);

	async function pay() {
		if (!connected.length) {
			Alert.alert(
				"No payment app connected",
				"Connect Google Pay, PhonePe or Paytm in Settings → Payment apps.",
			);
			return;
		}
		const app = UPI_APPS.find((a) => a.id === connected[0]);
		if (app) {
			Linking.openURL(app.scheme).catch(() =>
				Alert.alert("Couldn't open", `${app.name} isn't installed.`),
			);
		}
	}

	function openEmail(emailId: string) {
		if (!mailboxId) return;
		router.push({
			pathname: "/email/[messageId]",
			params: { messageId: emailId, mailboxId },
		});
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<Stack.Screen options={{ title: "Smart Tasks" }} />
				<ActivityIndicator size="large" color="#141718" />
			</View>
		);
	}

	const payments = items.filter((i) => i.taskType === "PAYMENT");
	const actions = items.filter((i) => i.taskType === "ACTION");

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ padding: 16 }}
			refreshControl={
				<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
			}
		>
			<Stack.Screen options={{ title: "Smart Tasks" }} />

			{items.length === 0 ? (
				<View style={styles.empty}>
					<Ionicons
						name="checkmark-done-circle-outline"
						size={56}
						color="#c4c7cc"
					/>
					<Text style={styles.emptyText}>
						No payments or tasks found yet. They appear here as MailMonkey reads
						your mail.
					</Text>
				</View>
			) : null}

			{payments.length > 0 ? (
				<>
					<Text style={styles.section}>Payments</Text>
					{payments.map((p) => (
						<View key={p.emailId} style={styles.payCard}>
							<Pressable style={{ flex: 1 }} onPress={() => openEmail(p.emailId)}>
								<Text style={styles.payMerchant}>
									{p.payMerchant || p.taskTitle || "Payment"}
								</Text>
								{p.taskDue ? <Text style={styles.due}>Due {p.taskDue}</Text> : null}
								{p.aiSummary ? (
									<Text style={styles.summary} numberOfLines={2}>
										{p.aiSummary}
									</Text>
								) : null}
							</Pressable>
							<View style={styles.payRight}>
								{p.payAmount ? (
									<Text style={styles.amount}>{p.payAmount}</Text>
								) : null}
								<Pressable style={styles.payBtn} onPress={pay}>
									<Text style={styles.payBtnText}>Pay</Text>
								</Pressable>
							</View>
						</View>
					))}
				</>
			) : null}

			{actions.length > 0 ? (
				<>
					<Text style={styles.section}>To do</Text>
					<View style={styles.group}>
						{actions.map((a, i) => (
							<Pressable
								key={a.emailId}
								style={[
									styles.taskRow,
									i === actions.length - 1 && { borderBottomWidth: 0 },
								]}
								onPress={() => openEmail(a.emailId)}
							>
								<Ionicons name="ellipse-outline" size={20} color="#141718" />
								<View style={{ flex: 1 }}>
									<Text style={styles.taskTitle}>
										{a.taskTitle || a.aiSummary || "Follow up"}
									</Text>
									{a.taskDue ? (
										<Text style={styles.due}>Due {a.taskDue}</Text>
									) : null}
								</View>
								<Ionicons name="chevron-forward" size={18} color="#c4c7cc" />
							</Pressable>
						))}
					</View>
				</>
			) : null}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	empty: { alignItems: "center", paddingTop: 80, paddingHorizontal: 20 },
	emptyText: {
		fontSize: 15,
		color: "#9aa0a6",
		textAlign: "center",
		marginTop: 12,
		lineHeight: 21,
	},
	section: {
		fontSize: 13,
		fontWeight: "600",
		color: "#9aa0a6",
		textTransform: "uppercase",
		marginTop: 12,
		marginBottom: 10,
	},
	payCard: {
		flexDirection: "row",
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 16,
		marginBottom: 10,
		alignItems: "center",
	},
	payMerchant: { fontSize: 16, fontWeight: "600", color: "#111" },
	due: { fontSize: 13, color: "#d97706", marginTop: 2 },
	summary: { fontSize: 13, color: "#6b7280", marginTop: 4 },
	payRight: { alignItems: "flex-end", marginLeft: 12 },
	amount: { fontSize: 18, fontWeight: "700", color: "#111", marginBottom: 6 },
	payBtn: {
		backgroundColor: "#22a06b",
		borderRadius: 10,
		paddingHorizontal: 20,
		paddingVertical: 8,
	},
	payBtnText: { color: "#fff", fontWeight: "700" },
	group: { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" },
	taskRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	taskTitle: { fontSize: 15, color: "#111" },
});
