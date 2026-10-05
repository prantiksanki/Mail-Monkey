import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Linking,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { WebView } from "react-native-webview";
import { api, type FullEmail } from "@/lib/api";

// Wrap raw email HTML in a responsive document so it fits the phone width.
function buildHtmlDocument(bodyHtml: string): string {
	return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html,body{margin:0;padding:14px;background:#fff;color:#111;
    font-family:-apple-system,Roboto,'Segoe UI',sans-serif;font-size:15px;line-height:1.5;
    word-wrap:break-word;overflow-wrap:break-word;-webkit-text-size-adjust:100%;}
  img{max-width:100% !important;height:auto !important;}
  table{max-width:100% !important;}
  a{color:#141718;}
  * {max-width:100% !important;}
</style></head><body>${bodyHtml}</body></html>`;
}

export default function EmailScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{
		messageId: string;
		mailboxId: string;
	}>();
	const messageId = params.messageId ?? "";
	const mailboxId = params.mailboxId ?? "";

	const [email, setEmail] = useState<FullEmail | null>(null);
	const [loading, setLoading] = useState(true);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async () => {
		try {
			const msg = await api.getMessage(mailboxId, messageId);
			setEmail(msg);
			api.markRead(mailboxId, messageId).catch(() => {});
		} catch (e) {
			Alert.alert("Error", e instanceof Error ? e.message : "Failed to load");
		} finally {
			setLoading(false);
		}
	}, [mailboxId, messageId]);

	useEffect(() => {
		load();
	}, [load]);

	async function runAction(fn: () => Promise<unknown>, failMsg: string) {
		setBusy(true);
		try {
			await fn();
			router.back();
		} catch (e) {
			Alert.alert("Error", e instanceof Error ? e.message : failMsg);
			setBusy(false);
		}
	}

	const handleArchive = () =>
		runAction(() => api.archive(mailboxId, messageId), "Failed to archive");
	const handleTrash = () =>
		runAction(() => api.trash(mailboxId, messageId), "Failed to trash");
	const handleUnread = () =>
		runAction(
			() => api.markUnread(mailboxId, messageId),
			"Failed to mark unread",
		);
	const handleSnooze = () =>
		runAction(
			() =>
				api.snooze(
					mailboxId,
					messageId,
					new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
				),
			"Failed to snooze",
		);

	if (loading) {
		return (
			<View style={styles.center}>
				<ActivityIndicator size="large" color="#141718" />
			</View>
		);
	}
	if (!email) {
		return (
			<View style={styles.center}>
				<Text style={styles.muted}>Email not found.</Text>
			</View>
		);
	}

	const hasHtml = Boolean(email.bodyHtml?.trim());

	return (
		<View style={styles.container}>
			<Stack.Screen options={{ title: "" }} />

			{/* Header */}
			<View style={styles.header}>
				<Text style={styles.subject}>{email.subject}</Text>
				<Text style={styles.from}>{email.from}</Text>
				<Text style={styles.date}>
					{new Date(email.date).toLocaleString(undefined, {
						weekday: "short",
						month: "short",
						day: "numeric",
						hour: "numeric",
						minute: "2-digit",
					})}
				</Text>
			</View>

			{/* Body: real HTML in a WebView, or plain text */}
			{hasHtml ? (
				<WebView
					originWhitelist={["*"]}
					source={{ html: buildHtmlDocument(email.bodyHtml) }}
					style={styles.webview}
					// Open tapped links in the system browser, not inside the app.
					onShouldStartLoadWithRequest={(req) => {
						if (req.url === "about:blank") return true;
						if (/^https?:\/\//.test(req.url)) {
							Linking.openURL(req.url).catch(() => {});
							return false;
						}
						return true;
					}}
					showsVerticalScrollIndicator
				/>
			) : (
				<ScrollView contentContainerStyle={styles.scroll}>
					<Text style={styles.body}>
						{email.bodyText?.trim() || email.snippet || "(No content)"}
					</Text>
				</ScrollView>
			)}

			{/* Actions */}
			<View style={styles.actions}>
				<Pressable style={styles.action} onPress={handleArchive} disabled={busy}>
					<Ionicons name="archive-outline" size={22} color="#141718" />
					<Text style={styles.actionText}>Archive</Text>
				</Pressable>
				<Pressable style={styles.action} onPress={handleSnooze} disabled={busy}>
					<Ionicons name="time-outline" size={22} color="#141718" />
					<Text style={styles.actionText}>Snooze</Text>
				</Pressable>
				<Pressable style={styles.action} onPress={handleUnread} disabled={busy}>
					<Ionicons name="mail-unread-outline" size={22} color="#141718" />
					<Text style={styles.actionText}>Unread</Text>
				</Pressable>
				<Pressable style={styles.action} onPress={handleTrash} disabled={busy}>
					<Ionicons name="trash-outline" size={22} color="#dc2626" />
					<Text style={[styles.actionText, { color: "#dc2626" }]}>Trash</Text>
				</Pressable>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	center: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 24,
	},
	muted: { color: "#6b7280", fontSize: 15 },
	header: {
		paddingHorizontal: 18,
		paddingTop: 14,
		paddingBottom: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#e5e7eb",
	},
	subject: { fontSize: 20, fontWeight: "700", color: "#111" },
	from: { fontSize: 14, color: "#374151", marginTop: 8 },
	date: { fontSize: 13, color: "#9aa0a6", marginTop: 2 },
	webview: { flex: 1, backgroundColor: "#fff" },
	scroll: { padding: 18 },
	body: { fontSize: 15, color: "#1f2937", lineHeight: 22 },
	actions: {
		flexDirection: "row",
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#e5e7eb",
		paddingVertical: 10,
	},
	action: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
	actionText: { fontSize: 12, color: "#141718", fontWeight: "600" },
});
