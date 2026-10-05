import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { getPref, setPref } from "@/lib/prefs";

type Theme = "system" | "light" | "dark";

const OPTIONS: { id: Theme; label: string; icon: keyof typeof Ionicons.glyphMap }[] =
	[
		{ id: "system", label: "System default", icon: "phone-portrait-outline" },
		{ id: "light", label: "Light", icon: "sunny-outline" },
		{ id: "dark", label: "Dark", icon: "moon-outline" },
	];

export default function AppearanceScreen() {
	const [theme, setTheme] = useState<Theme>("system");

	useEffect(() => {
		getPref<Theme>("theme", "system").then(setTheme);
	}, []);

	function pick(t: Theme) {
		setTheme(t);
		setPref("theme", t);
	}

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Appearance" }} />
			<View style={styles.group}>
				{OPTIONS.map((o, i) => (
					<Pressable
						key={o.id}
						style={[styles.row, i === OPTIONS.length - 1 && { borderBottomWidth: 0 }]}
						onPress={() => pick(o.id)}
					>
						<Ionicons name={o.icon} size={20} color="#141718" />
						<Text style={styles.label}>{o.label}</Text>
						{theme === o.id ? (
							<Ionicons name="checkmark" size={20} color="#141718" />
						) : null}
					</Pressable>
				))}
			</View>
			<Text style={styles.hint}>
				Dark theme is rolling out screen by screen — your choice is saved and
				applies as it lands.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa", padding: 16 },
	group: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		padding: 15,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	label: { flex: 1, fontSize: 16, color: "#111" },
	hint: { fontSize: 13, color: "#9aa0a6", marginTop: 16, paddingHorizontal: 4 },
});
