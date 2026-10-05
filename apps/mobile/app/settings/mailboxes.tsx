import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { api, type Mailbox } from "@/lib/api";

export default function MailboxesScreen() {
	const [mailboxes, setMailboxes] = useState<Mailbox[] | null>(null);

	useEffect(() => {
		api
			.getMailboxes()
			.then(setMailboxes)
			.catch(() => setMailboxes([]));
	}, []);

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Mailboxes" }} />
			{mailboxes === null ? (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#141718" />
				</View>
			) : mailboxes.length === 0 ? (
				<View style={styles.center}>
					<Text style={styles.muted}>
						No mailboxes connected. Add one in the Zeromail web app.
					</Text>
				</View>
			) : (
				<View style={styles.group}>
					{mailboxes.map((m, i) => (
						<View
							key={m.id}
							style={[
								styles.row,
								i === mailboxes.length - 1 && { borderBottomWidth: 0 },
							]}
						>
							<View
								style={[
									styles.icon,
									{
										backgroundColor:
											m.provider === "GOOGLE" ? "#ea433515" : "#0078d415",
									},
								]}
							>
								<Ionicons
									name="mail"
									size={20}
									color={m.provider === "GOOGLE" ? "#ea4335" : "#0078d4"}
								/>
							</View>
							<View style={{ flex: 1 }}>
								<Text style={styles.provider}>
									{m.provider === "GOOGLE" ? "Gmail" : "Outlook"}
								</Text>
								<Text style={styles.email} numberOfLines={1}>
									{m.email}
								</Text>
							</View>
							<Ionicons name="checkmark-circle" size={20} color="#22a06b" />
						</View>
					))}
				</View>
			)}
			<Text style={styles.hint}>
				Adding & removing mailboxes is managed in the Zeromail web app for now.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa", padding: 16 },
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
	muted: { color: "#6b7280", fontSize: 15, textAlign: "center" },
	group: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	icon: {
		width: 40,
		height: 40,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	provider: { fontSize: 16, fontWeight: "600", color: "#111" },
	email: { fontSize: 14, color: "#6b7280", marginTop: 1 },
	hint: { fontSize: 13, color: "#9aa0a6", marginTop: 16, paddingHorizontal: 4 },
});
