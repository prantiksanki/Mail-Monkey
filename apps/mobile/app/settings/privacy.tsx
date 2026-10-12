import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";

const POINTS = [
	{
		icon: "lock-closed-outline" as const,
		title: "Your mail stays yours",
		body: "Emails are synced to your private account and never shared or sold.",
	},
	{
		icon: "sparkles-outline" as const,
		title: "AI runs on your data only",
		body: "Summaries, labels, and MonkeyChan answers are generated from your own mailbox, for you.",
	},
	{
		icon: "key-outline" as const,
		title: "Secure sign-in",
		body: "Access is protected by your Google account and encrypted tokens on this device.",
	},
];

export default function PrivacyScreen() {
	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ padding: 16 }}
		>
			<Stack.Screen options={{ title: "Privacy & Security" }} />
			{POINTS.map((p) => (
				<View key={p.title} style={styles.card}>
					<Ionicons name={p.icon} size={22} color="#141718" />
					<View style={{ flex: 1, marginLeft: 12 }}>
						<Text style={styles.title}>{p.title}</Text>
						<Text style={styles.body}>{p.body}</Text>
					</View>
				</View>
			))}
			<Text style={styles.hint}>
				A full privacy policy and data-export controls are coming before
				public launch.
			</Text>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	card: {
		flexDirection: "row",
		backgroundColor: "#fff",
		borderRadius: 14,
		padding: 16,
		marginBottom: 12,
	},
	title: { fontSize: 16, fontWeight: "600", color: "#111" },
	body: { fontSize: 14, color: "#6b7280", marginTop: 4, lineHeight: 20 },
	hint: {
		fontSize: 13,
		color: "#9aa0a6",
		marginTop: 8,
		paddingHorizontal: 4,
	},
});
