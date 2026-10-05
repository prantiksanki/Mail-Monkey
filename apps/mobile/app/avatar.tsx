import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
	MONKEY_COUNT,
	MONKEY_NAMES,
	MONKEY_UNLOCKS,
	MonkeyAvatar,
} from "@/components/monkey-avatar";
import { api } from "@/lib/api";
import { getAvatar, setAvatar } from "@/lib/avatar";

export default function AvatarScreen() {
	const [selected, setSelected] = useState(0);
	const [handled, setHandled] = useState(0);

	useEffect(() => {
		getAvatar().then(setSelected);
		// "Handled" = emails MailMonkey has processed for you (drives unlocks).
		api
			.getMailboxes()
			.then((m) => (m[0] ? api.getMailboxAi(m[0].id) : { items: [] }))
			.then((ai) => setHandled(ai.items.length))
			.catch(() => {});
	}, []);

	async function pick(variant: number) {
		if (handled < MONKEY_UNLOCKS[variant]) return; // locked
		setSelected(variant);
		await setAvatar(variant);
	}

	// Progress toward the next locked monkey.
	const nextLockIndex = MONKEY_UNLOCKS.findIndex((u) => handled < u);
	const nextTarget = nextLockIndex >= 0 ? MONKEY_UNLOCKS[nextLockIndex] : null;

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "My Avatar" }} />
			<Text style={styles.heading}>Your monkey collection</Text>
			<Text style={styles.sub}>
				{handled} emails handled · unlock more as MailMonkey works for you
			</Text>

			{nextTarget !== null ? (
				<View style={styles.progressWrap}>
					<View style={styles.progressTrack}>
						<View
							style={[
								styles.progressFill,
								{
									width: `${Math.min(100, (handled / nextTarget) * 100)}%`,
								},
							]}
						/>
					</View>
					<Text style={styles.progressText}>
						{nextTarget - handled} more to unlock {MONKEY_NAMES[nextLockIndex]}
					</Text>
				</View>
			) : (
				<Text style={styles.progressText}>All monkeys unlocked! 🎉</Text>
			)}

			<View style={styles.grid}>
				{Array.from({ length: MONKEY_COUNT }).map((_, i) => {
					const locked = handled < MONKEY_UNLOCKS[i];
					return (
						<Pressable
							key={i}
							onPress={() => pick(i)}
							style={[
								styles.cell,
								selected === i && styles.cellActive,
								locked && styles.cellLocked,
							]}
						>
							<View style={locked ? { opacity: 0.35 } : undefined}>
								<MonkeyAvatar variant={i} size={78} />
							</View>
							<Text style={styles.monkeyName}>{MONKEY_NAMES[i]}</Text>
							{locked ? (
								<View style={styles.lockBadge}>
									<Ionicons name="lock-closed" size={12} color="#6b7280" />
									<Text style={styles.lockText}>{MONKEY_UNLOCKS[i]}</Text>
								</View>
							) : selected === i ? (
								<View style={styles.check}>
									<Ionicons name="checkmark-circle" size={20} color="#141718" />
								</View>
							) : null}
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff", padding: 20 },
	heading: { fontSize: 22, fontWeight: "700", color: "#111", marginTop: 8 },
	sub: { fontSize: 14, color: "#6b7280", marginTop: 4 },
	progressWrap: { marginTop: 18 },
	progressTrack: {
		height: 8,
		backgroundColor: "#f1f3f5",
		borderRadius: 4,
		overflow: "hidden",
	},
	progressFill: { height: "100%", backgroundColor: "#141718", borderRadius: 4 },
	progressText: { fontSize: 13, color: "#6b7280", marginTop: 8, textAlign: "center" },
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 12,
		marginTop: 24,
		justifyContent: "space-between",
	},
	cell: {
		width: "30%",
		aspectRatio: 0.85,
		borderRadius: 16,
		alignItems: "center",
		justifyContent: "center",
		borderWidth: 2,
		borderColor: "transparent",
		backgroundColor: "#f7f8fa",
		marginBottom: 12,
	},
	cellActive: { borderColor: "#141718", backgroundColor: "#eef6ff" },
	cellLocked: { backgroundColor: "#f2f2f4" },
	monkeyName: { fontSize: 13, fontWeight: "600", color: "#374151", marginTop: 6 },
	check: { position: "absolute", top: 6, right: 6 },
	lockBadge: {
		flexDirection: "row",
		alignItems: "center",
		gap: 3,
		position: "absolute",
		top: 6,
		right: 6,
		backgroundColor: "#e5e7eb",
		borderRadius: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
	},
	lockText: { fontSize: 11, color: "#6b7280", fontWeight: "600" },
});
