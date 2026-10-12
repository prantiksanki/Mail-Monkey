import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { GoogleG } from "@/components/brand/google-g";
import {
	getPaymentApps,
	setPaymentApps,
	UPI_APPS,
	type UpiApp,
} from "@/lib/payments";

function AppLogo({ id, color }: { id: UpiApp; color: string }) {
	if (id === "gpay") {
		return (
			<View
				style={[
					styles.logo,
					{
						backgroundColor: "#fff",
						borderWidth: 1,
						borderColor: "#eee",
					},
				]}
			>
				<GoogleG size={26} />
			</View>
		);
	}
	// Paytm — the two-tone "paytm" wordmark on white.
	if (id === "paytm") {
		return (
			<View
				style={[
					styles.logo,
					{
						backgroundColor: "#fff",
						borderWidth: 1,
						borderColor: "#eee",
					},
				]}
			>
				<Text style={styles.paytm} numberOfLines={1}>
					<Text style={{ color: "#002970" }}>pay</Text>
					<Text style={{ color: "#00baf2" }}>tm</Text>
				</Text>
			</View>
		);
	}
	// PhonePe — purple badge with the Devanagari "पे" from its real logo.
	return (
		<View style={[styles.logo, { backgroundColor: color }]}>
			<Text style={styles.phonepe}>पे</Text>
		</View>
	);
}

export default function PaymentsScreen() {
	const router = useRouter();
	const [connected, setConnected] = useState<UpiApp[]>([]);

	useEffect(() => {
		getPaymentApps().then(setConnected);
	}, []);

	async function toggle(id: UpiApp) {
		const next = connected.includes(id)
			? connected.filter((a) => a !== id)
			: [...connected, id];
		setConnected(next);
		await setPaymentApps(next);
	}

	return (
		<ScrollView
			style={styles.container}
			contentContainerStyle={{ padding: 20 }}
		>
			<Stack.Screen options={{ title: "Payment options" }} />

			<Text style={styles.section}>Cards</Text>
			<Pressable
				style={styles.cardRow}
				onPress={() => router.push("/settings/add-card")}
			>
				<View style={styles.cardIcon}>
					<Ionicons name="card-outline" size={20} color="#141718" />
				</View>
				<Text style={styles.cardRowText}>Add your cards</Text>
				<Ionicons name="chevron-forward" size={18} color="#c4c7cc" />
			</Pressable>

			<Text style={[styles.section, { marginTop: 26 }]}>
				Payment apps
			</Text>
			<Text style={styles.intro}>
				Connect your UPI apps. When a bill or payment email arrives,
				MailMonkey can open your app pre-filled — pay in one tap.
			</Text>

			{UPI_APPS.map((app) => {
				const on = connected.includes(app.id);
				return (
					<Pressable
						key={app.id}
						style={styles.appRow}
						onPress={() => toggle(app.id)}
					>
						<AppLogo id={app.id} color={app.color} />
						<Text style={styles.appName}>{app.name}</Text>
						{on ? (
							<View style={styles.connected}>
								<Ionicons
									name="checkmark-circle"
									size={22}
									color="#22a06b"
								/>
								<Text style={styles.connectedText}>
									Connected
								</Text>
							</View>
						) : (
							<Text style={styles.connect}>Connect</Text>
						)}
					</Pressable>
				);
			})}

			<View style={styles.note}>
				<Ionicons
					name="information-circle-outline"
					size={18}
					color="#9aa0a6"
				/>
				<Text style={styles.noteText}>
					One-tap pay from payment emails is coming soon. For now this
					saves your preferred apps.
				</Text>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	section: {
		fontSize: 13,
		fontWeight: "700",
		color: "#111",
		textTransform: "uppercase",
		letterSpacing: 0.5,
		marginBottom: 10,
	},
	cardRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		paddingHorizontal: 12,
		backgroundColor: "#f7f8fa",
		borderRadius: 14,
	},
	cardIcon: {
		width: 36,
		height: 36,
		borderRadius: 10,
		backgroundColor: "#eceef1",
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	cardRowText: { flex: 1, fontSize: 16, color: "#111", fontWeight: "500" },
	intro: { fontSize: 14, color: "#6b7280", lineHeight: 20, marginBottom: 20 },
	appRow: {
		flexDirection: "row",
		alignItems: "center",
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#eee",
	},
	logo: {
		width: 44,
		height: 44,
		borderRadius: 12,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 14,
	},
	logoText: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
		fontStyle: "italic",
	},
	phonepe: { color: "#fff", fontSize: 20, fontWeight: "700" },
	paytm: { fontSize: 11, fontWeight: "800", letterSpacing: -0.4 },
	appName: { flex: 1, fontSize: 16, color: "#111", fontWeight: "500" },
	connect: { fontSize: 15, color: "#141718", fontWeight: "600" },
	connected: { flexDirection: "row", alignItems: "center", gap: 4 },
	connectedText: { fontSize: 13, color: "#22a06b", fontWeight: "600" },
	note: {
		flexDirection: "row",
		gap: 8,
		backgroundColor: "#f7f8fa",
		borderRadius: 12,
		padding: 14,
		marginTop: 24,
	},
	noteText: { flex: 1, fontSize: 13, color: "#6b7280", lineHeight: 18 },
});
