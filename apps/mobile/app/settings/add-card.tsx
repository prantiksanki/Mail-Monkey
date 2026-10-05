import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
} from "react-native";

// Mastercard mark — two overlapping circles (drawn, not an asset).
function Mastercard({ size = 34 }: { size?: number }) {
	const c = size * 0.62;
	return (
		<View style={{ width: size, height: c, flexDirection: "row" }}>
			<View
				style={{
					width: c,
					height: c,
					borderRadius: c / 2,
					backgroundColor: "#eb001b",
				}}
			/>
			<View
				style={{
					width: c,
					height: c,
					borderRadius: c / 2,
					backgroundColor: "#f79e1b",
					marginLeft: -c * 0.45,
					opacity: 0.9,
				}}
			/>
		</View>
	);
}

// Group a 16-digit string into "1234 5678 9012 3456".
function groupNumber(raw: string): string {
	const digits = raw.replace(/\D/g, "").slice(0, 16);
	return digits.replace(/(.{4})/g, "$1 ").trim();
}

export default function AddCardScreen() {
	const router = useRouter();
	const [number, setNumber] = useState("");
	const [holder, setHolder] = useState("");
	const [mm, setMM] = useState("");
	const [yy, setYY] = useState("");
	const [cvc, setCvc] = useState("");
	const [isDefault, setIsDefault] = useState(true);

	const save = () => {
		// No card backend yet — acknowledge and go back.
		Alert.alert("Card added", "Saved to this device for now.", [
			{ text: "OK", onPress: () => router.back() },
		]);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Add New Card" }} />
			<ScrollView
				style={styles.container}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
			>
				{/* card preview */}
				<View style={styles.cardShadow} />
				<View style={styles.card}>
					<View style={styles.cardTop}>
						<View style={styles.chip} />
						<Ionicons
							name="ellipsis-horizontal"
							size={20}
							color="#fff"
						/>
					</View>
					<Text style={styles.cardNumber}>
						{number ? groupNumber(number) : "1020 2345 6789 6372"}
					</Text>
					<View style={styles.cardBottom}>
						<View>
							<Text style={styles.cardHint}>Card Holder</Text>
							<Text style={styles.cardName}>
								{holder || "Name Here"}
							</Text>
						</View>
						<Mastercard size={40} />
					</View>
				</View>

				<Text style={styles.heading}>Enter Information</Text>

				<Text style={styles.label}>Card Number</Text>
				<View style={styles.field}>
					<TextInput
						style={styles.input}
						value={number}
						onChangeText={(t) => setNumber(t.replace(/\D/g, ""))}
						keyboardType="number-pad"
						placeholder="•••• •••• •••• ••••"
						placeholderTextColor="#c9ccd4"
						maxLength={16}
					/>
					<Mastercard size={30} />
				</View>

				<Text style={styles.label}>Card Holder</Text>
				<View style={styles.field}>
					<TextInput
						style={styles.input}
						value={holder}
						onChangeText={setHolder}
						placeholder="Tom Hillson"
						placeholderTextColor="#c9ccd4"
					/>
				</View>

				<View style={styles.row}>
					<View style={{ flex: 1 }}>
						<Text style={styles.label}>Expiration Date</Text>
						<View style={styles.smallRow}>
							<View style={styles.smallField}>
								<TextInput
									style={styles.smallInput}
									value={mm}
									onChangeText={(t) =>
										setMM(t.replace(/\D/g, "").slice(0, 2))
									}
									keyboardType="number-pad"
									placeholder="MM"
									placeholderTextColor="#c9ccd4"
									maxLength={2}
								/>
							</View>
							<View style={styles.smallField}>
								<TextInput
									style={styles.smallInput}
									value={yy}
									onChangeText={(t) =>
										setYY(t.replace(/\D/g, "").slice(0, 2))
									}
									keyboardType="number-pad"
									placeholder="YY"
									placeholderTextColor="#c9ccd4"
									maxLength={2}
								/>
							</View>
						</View>
					</View>
					<View>
						<Text style={styles.label}>CVC</Text>
						<View style={[styles.smallField, { width: 96 }]}>
							<TextInput
								style={styles.smallInput}
								value={cvc}
								onChangeText={(t) =>
									setCvc(t.replace(/\D/g, "").slice(0, 4))
								}
								keyboardType="number-pad"
								placeholder="231"
								placeholderTextColor="#c9ccd4"
								maxLength={4}
								secureTextEntry
							/>
						</View>
					</View>
				</View>

				<View style={styles.toggleRow}>
					<Switch
						value={isDefault}
						onValueChange={setIsDefault}
						trackColor={{ true: "#141718", false: "#e6e8ec" }}
						thumbColor="#fff"
					/>
					<Text style={styles.toggleLabel}>Mark as default card</Text>
				</View>

				<Pressable style={styles.saveBtn} onPress={save}>
					<Text style={styles.saveText}>Add Card</Text>
				</Pressable>
			</ScrollView>
		</>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	content: { padding: 24, paddingBottom: 48 },
	// soft shadow card peeking behind
	cardShadow: {
		position: "absolute",
		top: 38,
		left: 24,
		right: 24,
		height: 178,
		borderRadius: 20,
		backgroundColor: "#141718",
		opacity: 0.4,
	},
	card: {
		height: 178,
		borderRadius: 20,
		backgroundColor: "#141718",
		padding: 20,
		justifyContent: "space-between",
	},
	cardTop: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	chip: {
		width: 30,
		height: 22,
		borderRadius: 6,
		backgroundColor: "#d9b970",
	},
	cardNumber: {
		color: "#fff",
		fontSize: 17,
		fontWeight: "600",
		letterSpacing: 2,
	},
	cardBottom: {
		flexDirection: "row",
		alignItems: "flex-end",
		justifyContent: "space-between",
	},
	cardHint: { color: "rgba(255,255,255,0.75)", fontSize: 12 },
	cardName: { color: "#fff", fontSize: 17, fontWeight: "600", marginTop: 2 },
	heading: {
		fontSize: 24,
		fontWeight: "700",
		color: "#111827",
		marginTop: 28,
		letterSpacing: -0.4,
	},
	label: {
		fontSize: 14,
		fontWeight: "500",
		color: "#111827",
		marginTop: 18,
		marginBottom: 8,
	},
	field: {
		flexDirection: "row",
		alignItems: "center",
		height: 56,
		borderWidth: 1.5,
		borderColor: "#141718",
		borderRadius: 15,
		paddingHorizontal: 16,
	},
	input: {
		flex: 1,
		fontSize: 15,
		color: "#141718",
		marginRight: 8,
		padding: 0,
		textAlignVertical: "center",
		includeFontPadding: false,
	},
	row: { flexDirection: "row", gap: 12 },
	smallRow: { flexDirection: "row", gap: 10 },
	smallField: {
		height: 40,
		width: 72,
		borderWidth: 1.5,
		borderColor: "#141718",
		borderRadius: 8,
		justifyContent: "center",
		paddingHorizontal: 14,
	},
	// padding:0 + textAlignVertical center removes Android's default top pad so
	// the placeholder/number sits centered in the 40px box.
	smallInput: {
		fontSize: 15,
		color: "#141718",
		padding: 0,
		textAlignVertical: "center",
		includeFontPadding: false,
	},
	toggleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		marginTop: 26,
	},
	toggleLabel: { fontSize: 13, color: "#aaaaaa", fontWeight: "500" },
	saveBtn: {
		backgroundColor: "#141718",
		borderRadius: 999,
		paddingVertical: 17,
		alignItems: "center",
		marginTop: 30,
	},
	saveText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
