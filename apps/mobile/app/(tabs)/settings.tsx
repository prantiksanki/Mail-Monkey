import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { MonkeyAvatar } from "@/components/monkey-avatar";
import { api } from "@/lib/api";
import { signOut } from "@/lib/auth";
import { getAvatar } from "@/lib/avatar";

type RowProps = {
	icon: keyof typeof Ionicons.glyphMap;
	label: string;
	tint?: string;
	value?: string;
	soon?: boolean;
	onPress?: () => void;
};

function Row({
	icon,
	label,
	tint = "#141718",
	value,
	soon,
	onPress,
}: RowProps) {
	return (
		<Pressable
			style={styles.row}
			onPress={onPress ?? (() => Alert.alert(label, "Coming soon."))}
		>
			<View style={[styles.rowIcon, { backgroundColor: `${tint}1a` }]}>
				<Ionicons name={icon} size={18} color={tint} />
			</View>
			<Text style={styles.rowLabel}>{label}</Text>
			{value ? <Text style={styles.rowValue}>{value}</Text> : null}
			{soon ? <Text style={styles.soon}>Soon</Text> : null}
			<Ionicons name="chevron-forward" size={18} color="#c4c7cc" />
		</Pressable>
	);
}

export default function SettingsScreen() {
	const router = useRouter();
	const [name, setName] = useState("Your account");
	const [email, setEmail] = useState("");
	const [avatar, setAvatarVariant] = useState(0);
	const [mailboxCount, setMailboxCount] = useState(0);

	useFocusEffect(
		useCallback(() => {
			getAvatar().then(setAvatarVariant);
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
				.then((mbs) => {
					setMailboxCount(mbs.length);
					if (!email && mbs[0]) {
						setEmail(mbs[0].email);
					}
				})
				.catch(() => {});
		}, [email]),
	);

	async function handleSignOut() {
		await signOut();
		router.replace("/login");
	}

	return (
		<ScrollView style={styles.container}>
			{/* Profile header */}
			<Pressable
				style={styles.profile}
				onPress={() => router.push("/avatar")}
			>
				<MonkeyAvatar variant={avatar} size={64} />
				<View style={styles.profileText}>
					<Text style={styles.profileName}>{name}</Text>
					<Text style={styles.profileEmail}>{email}</Text>
				</View>
				<Ionicons name="chevron-forward" size={20} color="#c4c7cc" />
			</Pressable>

			<Text style={styles.groupTitle}>Intelligence</Text>
			<View style={styles.group}>
				<Row
					icon="sparkles-outline"
					label="AI Controls"
					tint="#141718"
					onPress={() => router.push("/settings/ai-controls")}
				/>
				<Row
					icon="checkmark-done-outline"
					label="Smart Tasks"
					tint="#141718"
					onPress={() => router.push("/settings/tasks")}
				/>
			</View>

			<View style={styles.group}>
				<Row
					icon="happy-outline"
					label="My Avatar"
					tint="#141718"
					onPress={() => router.push("/avatar")}
				/>
				<Row
					icon="person-outline"
					label="Account"
					onPress={() => router.push("/settings/account")}
				/>
				<Row
					icon="mail-outline"
					label="Mailboxes"
					value={mailboxCount ? String(mailboxCount) : undefined}
					onPress={() => router.push("/settings/mailboxes")}
				/>
			</View>

			<Text style={styles.groupTitle}>Automation</Text>
			<View style={styles.group}>
				<Row
					icon="flash-outline"
					label="Rules"
					onPress={() => router.push("/settings/rules")}
				/>
				<Row
					icon="bar-chart-outline"
					label="Analytics"
					tint="#141718"
					onPress={() => router.push("/settings/analytics")}
				/>
			</View>

			<Text style={styles.groupTitle}>Payments & Plan</Text>
			<View style={styles.group}>
				<Row
					icon="card-outline"
					label="Payment options"
					tint="#141718"
					onPress={() => router.push("/settings/payments")}
				/>
				<Row
					icon="sparkles-outline"
					label="Subscription"
					tint="#141718"
					onPress={() => router.push("/settings/subscription")}
				/>
			</View>

			<Text style={styles.groupTitle}>App</Text>
			<View style={styles.group}>
				<Row
					icon="notifications-outline"
					label="Notifications"
					onPress={() => router.push("/settings/notifications")}
				/>
				<Row
					icon="color-palette-outline"
					label="Appearance"
					onPress={() => router.push("/settings/appearance")}
				/>
				<Row
					icon="language-outline"
					label="Language"
					onPress={() => router.push("/settings/language")}
				/>
			</View>

			<Text style={styles.groupTitle}>More</Text>
			<View style={styles.group}>
				<Row
					icon="lock-closed-outline"
					label="Privacy & Security"
					onPress={() => router.push("/settings/privacy")}
				/>
				<Row
					icon="help-circle-outline"
					label="Help & Support"
					onPress={() => router.push("/settings/help")}
				/>
				<Row
					icon="information-circle-outline"
					label="About MailMonkey"
					onPress={() => router.push("/settings/about")}
				/>
			</View>

			<Pressable style={styles.signOut} onPress={handleSignOut}>
				<Text style={styles.signOutText}>Sign out</Text>
			</Pressable>
			<View style={{ height: 32 }} />
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	profile: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#fff",
		padding: 16,
		marginTop: 12,
		marginHorizontal: 12,
		borderRadius: 16,
	},
	profileText: { flex: 1, marginLeft: 14 },
	profileName: { fontSize: 19, fontWeight: "700", color: "#111" },
	profileEmail: { fontSize: 14, color: "#6b7280", marginTop: 2 },
	groupTitle: {
		fontSize: 13,
		color: "#8a8a8e",
		fontWeight: "600",
		marginLeft: 24,
		marginTop: 22,
		marginBottom: 6,
		textTransform: "uppercase",
	},
	group: {
		backgroundColor: "#fff",
		marginHorizontal: 12,
		marginTop: 12,
		borderRadius: 16,
		overflow: "hidden",
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	rowIcon: {
		width: 32,
		height: 32,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	rowLabel: { flex: 1, fontSize: 16, color: "#111" },
	rowValue: { fontSize: 15, color: "#9aa0a6", marginRight: 8 },
	soon: {
		fontSize: 11,
		color: "#9aa0a6",
		backgroundColor: "#f1f3f5",
		paddingHorizontal: 7,
		paddingVertical: 2,
		borderRadius: 6,
		marginRight: 8,
		overflow: "hidden",
	},
	signOut: {
		backgroundColor: "#fff",
		marginHorizontal: 12,
		marginTop: 22,
		borderRadius: 16,
		paddingVertical: 15,
		alignItems: "center",
	},
	signOutText: { color: "#dc2626", fontSize: 16, fontWeight: "600" },
});
