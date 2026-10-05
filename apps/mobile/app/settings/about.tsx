import { Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { MonkeyAvatar } from "@/components/monkey-avatar";

export default function AboutScreen() {
	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "About" }} />
			<MonkeyAvatar variant={0} size={96} />
			<Text style={styles.name}>MailMonkey</Text>
			<Text style={styles.version}>Version 0.1.0 (beta)</Text>
			<Text style={styles.tagline}>Your inbox, as a calm chat.</Text>
			<Text style={styles.credit}>Made by the MailMonkey team.</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#fff",
		alignItems: "center",
		justifyContent: "center",
		padding: 32,
	},
	name: { fontSize: 26, fontWeight: "800", color: "#111", marginTop: 16 },
	version: { fontSize: 14, color: "#9aa0a6", marginTop: 4 },
	tagline: { fontSize: 16, color: "#374151", marginTop: 18 },
	credit: { fontSize: 13, color: "#9aa0a6", marginTop: 8 },
});
