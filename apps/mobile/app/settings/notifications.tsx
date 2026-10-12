import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { getPref, setPref } from "@/lib/prefs";

type NotifPrefs = {
	push: boolean;
	dailyDigest: boolean;
	importantOnly: boolean;
};

const DEFAULTS: NotifPrefs = {
	push: true,
	dailyDigest: true,
	importantOnly: false,
};

export default function NotificationsScreen() {
	const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULTS);

	useEffect(() => {
		getPref("notifications", DEFAULTS).then(setPrefs);
	}, []);

	function update(key: keyof NotifPrefs, value: boolean) {
		const next = { ...prefs, [key]: value };
		setPrefs(next);
		setPref("notifications", next);
	}

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Notifications" }} />

			<View style={styles.group}>
				<ToggleRow
					label="Push notifications"
					desc="New mail alerts on this device"
					value={prefs.push}
					onChange={(v) => update("push", v)}
				/>
				<ToggleRow
					label="Important only"
					desc="Only notify for high-priority mail"
					value={prefs.importantOnly}
					onChange={(v) => update("importantOnly", v)}
				/>
				<ToggleRow
					label="Daily digest"
					desc="A morning summary of your inbox"
					value={prefs.dailyDigest}
					onChange={(v) => update("dailyDigest", v)}
					last
				/>
			</View>

			<Text style={styles.hint}>
				Push delivery is rolling out — these preferences are saved and
				applied once notifications go live.
			</Text>
		</View>
	);
}

function ToggleRow({
	label,
	desc,
	value,
	onChange,
	last,
}: {
	label: string;
	desc: string;
	value: boolean;
	onChange: (v: boolean) => void;
	last?: boolean;
}) {
	return (
		<View style={[styles.row, last && { borderBottomWidth: 0 }]}>
			<View style={{ flex: 1, marginRight: 12 }}>
				<Text style={styles.label}>{label}</Text>
				<Text style={styles.desc}>{desc}</Text>
			</View>
			<Switch
				value={value}
				onValueChange={onChange}
				trackColor={{ true: "#141718" }}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa", padding: 16 },
	group: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		padding: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
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
