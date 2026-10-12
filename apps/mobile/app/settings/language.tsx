import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

const LANGUAGES = [
	{ code: "en", name: "English", available: true },
	{ code: "hi", name: "हिन्दी (Hindi)", available: false },
	{ code: "es", name: "Español", available: false },
	{ code: "de", name: "Deutsch", available: false },
];

export default function LanguageScreen() {
	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Language" }} />
			<View style={styles.group}>
				{LANGUAGES.map((l, i) => (
					<View
						key={l.code}
						style={[
							styles.row,
							i === LANGUAGES.length - 1 && {
								borderBottomWidth: 0,
							},
						]}
					>
						<Text
							style={[
								styles.name,
								!l.available && { color: "#9aa0a6" },
							]}
						>
							{l.name}
						</Text>
						{l.available ? (
							<Ionicons
								name="checkmark"
								size={20}
								color="#141718"
							/>
						) : (
							<Text style={styles.soon}>Soon</Text>
						)}
					</View>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa", padding: 16 },
	group: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 15,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	name: { fontSize: 16, color: "#111" },
	soon: {
		fontSize: 12,
		color: "#9aa0a6",
		backgroundColor: "#f1f3f5",
		paddingHorizontal: 8,
		paddingVertical: 2,
		borderRadius: 6,
		overflow: "hidden",
	},
});
