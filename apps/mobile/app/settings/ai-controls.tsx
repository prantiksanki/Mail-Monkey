import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import {
	AI_DEFAULTS,
	type AiControls,
	getAiControls,
	setAiControls,
} from "@/lib/ai-prefs";

const ROWS: {
	key: keyof AiControls;
	label: string;
	desc: string;
	icon: keyof typeof Ionicons.glyphMap;
	tint: string;
}[] = [
	{
		key: "summaries",
		label: "AI summaries",
		desc: "Show insights in your tone instead of raw previews",
		icon: "sparkles-outline",
		tint: "#141718",
	},
	{
		key: "labels",
		label: "Smart labels & priority",
		desc: "Auto-categorize and rank your mail",
		icon: "pricetags-outline",
		tint: "#141718",
	},
	{
		key: "monkeychan",
		label: "MonkeyChan chat",
		desc: "Ask questions about your mailbox",
		icon: "chatbubbles-outline",
		tint: "#141718",
	},
	{
		key: "writing",
		label: "AI writing",
		desc: "Draft replies in your voice",
		icon: "create-outline",
		tint: "#141718",
	},
	{
		key: "notifications",
		label: "AI notifications",
		desc: "Only get alerted for what matters to you",
		icon: "notifications-outline",
		tint: "#141718",
	},
];

export default function AiControlsScreen() {
	const [controls, setControls] = useState<AiControls>(AI_DEFAULTS);

	useEffect(() => {
		getAiControls().then(setControls);
	}, []);

	function toggle(key: keyof AiControls, value: boolean) {
		const next = { ...controls, [key]: value };
		setControls(next);
		setAiControls(next);
	}

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "AI Controls" }} />

			<Text style={styles.intro}>
				MailMonkey is AI-native — but it's your mailbox. Turn AI on
				exactly where you want it.
			</Text>

			<View style={styles.group}>
				{ROWS.map((r, i) => (
					<View
						key={r.key}
						style={[
							styles.row,
							i === ROWS.length - 1 && { borderBottomWidth: 0 },
						]}
					>
						<View
							style={[
								styles.icon,
								{ backgroundColor: `${r.tint}1a` },
							]}
						>
							<Ionicons name={r.icon} size={18} color={r.tint} />
						</View>
						<View style={{ flex: 1, marginRight: 10 }}>
							<Text style={styles.label}>{r.label}</Text>
							<Text style={styles.desc}>{r.desc}</Text>
						</View>
						<Switch
							value={controls[r.key]}
							onValueChange={(v) => toggle(r.key, v)}
							trackColor={{ true: "#141718" }}
						/>
					</View>
				))}
			</View>

			<Text style={styles.hint}>
				Changes apply as you browse. Turning everything off keeps a
				plain, private inbox — no AI runs.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa", padding: 16 },
	intro: { fontSize: 14, color: "#6b7280", lineHeight: 20, marginBottom: 16 },
	group: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	icon: {
		width: 34,
		height: 34,
		borderRadius: 9,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	label: { fontSize: 16, color: "#111" },
	desc: { fontSize: 13, color: "#9aa0a6", marginTop: 2 },
	hint: {
		fontSize: 13,
		color: "#9aa0a6",
		marginTop: 16,
		paddingHorizontal: 4,
	},
});
