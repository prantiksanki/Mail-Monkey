import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const PLANS = [
	{
		name: "Free",
		price: "₹0",
		current: true,
		features: ["1 mailbox", "AI chat inbox", "Basic rules"],
	},
	{
		name: "Pro",
		price: "₹99/mo",
		current: false,
		features: [
			"Multiple mailboxes",
			"Unlimited rules",
			"AI insights in your tone",
			"Smart payment actions",
			"Priority sync",
		],
	},
];

export default function SubscriptionScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
			<Stack.Screen options={{ title: "Subscription" }} />

			<View style={styles.banner}>
				<Ionicons name="sparkles" size={18} color="#8b5cf6" />
				<Text style={styles.bannerText}>Paid plans are coming soon.</Text>
			</View>

			{PLANS.map((plan) => (
				<View
					key={plan.name}
					style={[styles.card, plan.current && styles.cardCurrent]}
				>
					<View style={styles.cardHead}>
						<Text style={styles.planName}>{plan.name}</Text>
						{plan.current ? (
							<View style={styles.badge}>
								<Text style={styles.badgeText}>Current</Text>
							</View>
						) : (
							<View style={styles.soonBadge}>
								<Text style={styles.soonText}>Soon</Text>
							</View>
						)}
					</View>
					<Text style={styles.price}>{plan.price}</Text>
					{plan.features.map((f) => (
						<View key={f} style={styles.featureRow}>
							<Ionicons name="checkmark" size={16} color="#22a06b" />
							<Text style={styles.feature}>{f}</Text>
						</View>
					))}
				</View>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	banner: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		backgroundColor: "#f5f3ff",
		borderRadius: 12,
		padding: 14,
		marginBottom: 18,
	},
	bannerText: { fontSize: 14, color: "#6d28d9", fontWeight: "600" },
	card: {
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 16,
		padding: 18,
		marginBottom: 14,
	},
	cardCurrent: { borderColor: "#141718", backgroundColor: "#f5faff" },
	cardHead: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	planName: { fontSize: 18, fontWeight: "700", color: "#111" },
	badge: {
		backgroundColor: "#141718",
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	badgeText: { color: "#fff", fontSize: 12, fontWeight: "600" },
	soonBadge: {
		backgroundColor: "#f1f3f5",
		borderRadius: 8,
		paddingHorizontal: 8,
		paddingVertical: 3,
	},
	soonText: { color: "#9aa0a6", fontSize: 12, fontWeight: "600" },
	price: { fontSize: 24, fontWeight: "700", color: "#111", marginVertical: 10 },
	featureRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
	feature: { fontSize: 14, color: "#374151" },
});
