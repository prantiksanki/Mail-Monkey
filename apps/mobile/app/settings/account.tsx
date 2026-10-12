import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MonkeyAvatar } from "@/components/monkey-avatar";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { getAvatar } from "@/lib/avatar";

export default function AccountScreen() {
	const router = useRouter();
	const [name, setName] = useState("Your account");
	const [email, setEmail] = useState("");
	const [avatar, setAvatar] = useState(0);

	useEffect(() => {
		getAvatar().then(setAvatar);
		api.getSession()
			.then((s) => {
				if (s?.user?.name) {
					setName(s.user.name);
				}
				if (s?.user?.email) {
					setEmail(s.user.email);
				}
			})
			.catch(() => {});
		api.getMailboxes()
			.then((m) => {
				if (!email && m[0]) {
					setEmail(m[0].email);
				}
			})
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	async function handleSignOut() {
		await signOut();
		router.replace("/login");
	}

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "Account" }} />

			<View style={styles.profile}>
				<MonkeyAvatar variant={avatar} size={88} />
				<Text style={styles.name}>{name}</Text>
				<Text style={styles.email}>{email}</Text>
				<Pressable
					style={styles.editAvatar}
					onPress={() => router.push("/avatar")}
				>
					<Text style={styles.editAvatarText}>Change avatar</Text>
				</Pressable>
			</View>

			<View style={styles.group}>
				<Row label="Name" value={name} />
				<Row label="Email" value={email} last />
			</View>

			<Pressable style={styles.signOut} onPress={handleSignOut}>
				<Text style={styles.signOutText}>Sign out</Text>
			</Pressable>
		</View>
	);
}

function Row({
	label,
	value,
	last,
}: {
	label: string;
	value: string;
	last?: boolean;
}) {
	return (
		<View style={[styles.row, last && { borderBottomWidth: 0 }]}>
			<Text style={styles.rowLabel}>{label}</Text>
			<Text style={styles.rowValue} numberOfLines={1}>
				{value}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa", padding: 16 },
	profile: { alignItems: "center", paddingVertical: 20 },
	name: { fontSize: 20, fontWeight: "700", color: "#111", marginTop: 12 },
	email: { fontSize: 14, color: "#6b7280", marginTop: 2 },
	editAvatar: {
		marginTop: 12,
		backgroundColor: "#eef2ff",
		borderRadius: 10,
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	editAvatarText: { color: "#4f46e5", fontWeight: "600" },
	group: {
		backgroundColor: "#fff",
		borderRadius: 16,
		overflow: "hidden",
		marginTop: 8,
	},
	row: {
		flexDirection: "row",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	rowLabel: { fontSize: 15, color: "#6b7280" },
	rowValue: {
		fontSize: 15,
		color: "#111",
		flex: 1,
		textAlign: "right",
		marginLeft: 12,
	},
	signOut: {
		backgroundColor: "#fff",
		borderRadius: 16,
		paddingVertical: 15,
		alignItems: "center",
		marginTop: 20,
	},
	signOutText: { color: "#dc2626", fontSize: 16, fontWeight: "600" },
});
