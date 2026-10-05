import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const FAQ = [
	{
		q: "Why don't all my emails have AI summaries yet?",
		a: "MailMonkey summarizes emails in batches. New mail is summarized automatically as it arrives.",
	},
	{
		q: "How does MonkeyChan know about my mail?",
		a: "It searches your synced emails by meaning and answers only from what it finds — it never makes things up.",
	},
	{
		q: "Is my email data safe?",
		a: "Yes. Your mail is private to your account and used only to power your own experience.",
	},
];

export default function HelpScreen() {
	return (
		<ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
			<Stack.Screen options={{ title: "Help & Support" }} />

			<Pressable
				style={styles.contact}
				onPress={() => Linking.openURL("mailto:support@mailmonkey.app")}
			>
				<Ionicons name="mail-outline" size={20} color="#fff" />
				<Text style={styles.contactText}>Contact support</Text>
			</Pressable>

			<Text style={styles.section}>FAQ</Text>
			{FAQ.map((f) => (
				<View key={f.q} style={styles.card}>
					<Text style={styles.q}>{f.q}</Text>
					<Text style={styles.a}>{f.a}</Text>
				</View>
			))}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	contact: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: 8,
		backgroundColor: "#141718",
		borderRadius: 12,
		paddingVertical: 14,
	},
	contactText: { color: "#fff", fontSize: 16, fontWeight: "600" },
	section: {
		fontSize: 13,
		fontWeight: "600",
		color: "#9aa0a6",
		textTransform: "uppercase",
		marginTop: 24,
		marginBottom: 10,
	},
	card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12 },
	q: { fontSize: 15, fontWeight: "600", color: "#111" },
	a: { fontSize: 14, color: "#6b7280", marginTop: 6, lineHeight: 20 },
});
