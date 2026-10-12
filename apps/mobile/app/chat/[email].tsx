import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { getAiControls } from "@/lib/ai-prefs";
import { api, type EmailAi, type InboxMessage, parseSender } from "@/lib/api";

type ChatItem = {
	id: string;
	kind: "in" | "out";
	subject?: string;
	text: string;
	date: string;
	insight?: boolean;
};

export default function ConversationScreen() {
	const params = useLocalSearchParams<{
		email: string;
		name: string;
		mailboxId: string;
	}>();
	const email = params.email ?? "";
	const name = params.name ?? email;
	const mailboxId = params.mailboxId ?? "";
	const headerHeight = useHeaderHeight();
	const router = useRouter();

	const [incoming, setIncoming] = useState<InboxMessage[]>([]);
	const [aiMap, setAiMap] = useState<Map<string, EmailAi>>(new Map());
	const [sent, setSent] = useState<ChatItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [reply, setReply] = useState("");
	const [sending, setSending] = useState(false);
	const [replyingTo, setReplyingTo] = useState<ChatItem | null>(null);

	const load = useCallback(async () => {
		try {
			const inbox = await api.getInbox(mailboxId, "inbox");
			const mine = (inbox.messages ?? []).filter(
				(m) => parseSender(m.from).email === email.toLowerCase(),
			);
			setIncoming(mine);
			// Only surface AI summaries if the user has that toggle on.
			const controls = await getAiControls();
			if (controls.summaries) {
				try {
					const ai = await api.getMailboxAi(mailboxId);
					setAiMap(new Map(ai.items.map((x) => [x.emailId, x])));
				} catch {}
			}
		} catch (e) {
			Alert.alert(
				"Error",
				e instanceof Error ? e.message : "Failed to load",
			);
		} finally {
			setLoading(false);
		}
	}, [mailboxId, email]);

	useEffect(() => {
		load();
	}, [load]);

	// Merge incoming + locally-sent messages, oldest first (chat order).
	const items = useMemo<ChatItem[]>(() => {
		const inItems: ChatItem[] = incoming.map((m) => {
			const ai = aiMap.get(m.id);
			return {
				id: m.id,
				kind: "in",
				subject: m.subject,
				// Prefer the AI insight; fall back to the raw snippet.
				text: ai?.aiSummary || m.snippet,
				date: m.date,
				insight: Boolean(ai?.aiSummary),
			};
		});
		return [...inItems, ...sent].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
		);
	}, [incoming, sent, aiMap]);

	const latestSubject = useMemo(() => incoming[0]?.subject ?? "", [incoming]);

	async function handleSend() {
		if (!reply.trim()) {
			return;
		}
		const text = reply.trim();
		const quoted = replyingTo;
		setSending(true);
		try {
			const baseSubject = quoted?.subject ?? latestSubject;
			const subject = baseSubject.startsWith("Re:")
				? baseSubject
				: `Re: ${baseSubject}`;
			// If replying to a specific message, quote it above the reply.
			const body = quoted ? `${text}\n\n> ${quoted.text}` : text;

			await api.send(mailboxId, { to: email, subject, body });

			// Echo the sent reply into the conversation immediately.
			setSent((prev) => [
				...prev,
				{
					id: `sent-${Date.now()}`,
					kind: "out",
					text,
					date: new Date().toISOString(),
				},
			]);
			setReply("");
			setReplyingTo(null);
		} catch (e) {
			Alert.alert(
				"Error",
				e instanceof Error ? e.message : "Failed to send",
			);
		} finally {
			setSending(false);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			// Android already resizes the window for the keyboard; adding the
			// header offset on top double-counts and lifts the input too high.
			keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
		>
			<Stack.Screen options={{ title: name }} />

			{loading ? (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#141718" />
				</View>
			) : (
				<FlatList
					data={items}
					keyExtractor={(m) => m.id}
					contentContainerStyle={{ padding: 12 }}
					renderItem={({ item }) => {
						if (item.kind === "out") {
							return (
								<View style={[styles.bubble, styles.bubbleOut]}>
									<Text style={styles.outText}>
										{item.text}
									</Text>
									<Text style={styles.outTime}>
										{new Date(item.date).toLocaleTimeString(
											undefined,
											{
												hour: "numeric",
												minute: "2-digit",
											},
										)}
									</Text>
								</View>
							);
						}
						return (
							<Pressable
								onPress={() =>
									router.push({
										pathname: "/email/[messageId]",
										params: {
											messageId: item.id,
											mailboxId,
										},
									})
								}
								onLongPress={() => setReplyingTo(item)}
								delayLongPress={250}
								style={[styles.bubble, styles.bubbleIn]}
							>
								{item.subject ? (
									<Text style={styles.inSubject}>
										{item.subject}
									</Text>
								) : null}
								<Text style={styles.inText}>{item.text}</Text>
								{item.insight ? (
									<Text style={styles.insightTag}>
										✦ AI summary
									</Text>
								) : null}
								<Text style={styles.inTime}>
									{new Date(item.date).toLocaleString(
										undefined,
										{
											month: "short",
											day: "numeric",
											hour: "numeric",
											minute: "2-digit",
										},
									)}
								</Text>
							</Pressable>
						);
					}}
					ListEmptyComponent={
						<View style={styles.center}>
							<Text style={styles.muted}>
								No messages from {name}.
							</Text>
						</View>
					}
				/>
			)}

			{replyingTo ? (
				<View style={styles.quoteBar}>
					<View style={styles.quoteAccent} />
					<View style={{ flex: 1 }}>
						<Text style={styles.quoteLabel}>Replying to</Text>
						<Text style={styles.quoteText} numberOfLines={1}>
							{replyingTo.subject || replyingTo.text}
						</Text>
					</View>
					<Pressable onPress={() => setReplyingTo(null)} hitSlop={8}>
						<Ionicons name="close" size={20} color="#9aa0a6" />
					</Pressable>
				</View>
			) : null}

			<View style={styles.inputBar}>
				<TextInput
					style={styles.input}
					placeholder={`Reply to ${name}…`}
					placeholderTextColor="#9aa0a6"
					value={reply}
					onChangeText={setReply}
					multiline
				/>
				<Pressable
					style={[
						styles.sendBtn,
						(!reply.trim() || sending) && styles.sendDisabled,
					]}
					onPress={handleSend}
					disabled={!reply.trim() || sending}
				>
					{sending ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Ionicons name="send" size={18} color="#fff" />
					)}
				</Pressable>
			</View>
		</KeyboardAvoidingView>
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
	bubble: {
		maxWidth: "85%",
		borderRadius: 16,
		padding: 12,
		marginBottom: 10,
	},
	bubbleIn: {
		alignSelf: "flex-start",
		backgroundColor: "#f1f3f5",
		borderTopLeftRadius: 4,
	},
	bubbleOut: {
		alignSelf: "flex-end",
		backgroundColor: "#141718",
		borderTopRightRadius: 4,
	},
	inSubject: { fontSize: 15, fontWeight: "600", color: "#111" },
	inText: { fontSize: 14, color: "#374151", marginTop: 3 },
	insightTag: {
		fontSize: 11,
		color: "#8b5cf6",
		fontWeight: "600",
		marginTop: 5,
	},
	inTime: { fontSize: 11, color: "#9aa0a6", marginTop: 6 },
	outText: { fontSize: 15, color: "#fff" },
	outTime: {
		fontSize: 11,
		color: "#dbeafe",
		marginTop: 4,
		alignSelf: "flex-end",
	},
	quoteBar: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 12,
		paddingVertical: 8,
		backgroundColor: "#f7f8fa",
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#e5e7eb",
	},
	quoteAccent: {
		width: 3,
		height: 34,
		borderRadius: 2,
		backgroundColor: "#141718",
		marginRight: 10,
	},
	quoteLabel: { fontSize: 12, color: "#141718", fontWeight: "600" },
	quoteText: { fontSize: 13, color: "#6b7280", marginTop: 1 },
	inputBar: {
		flexDirection: "row",
		alignItems: "flex-end",
		padding: 8,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#e5e7eb",
	},
	input: {
		flex: 1,
		maxHeight: 120,
		backgroundColor: "#f1f3f5",
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 10,
		fontSize: 15,
		color: "#111",
		marginRight: 8,
	},
	sendBtn: {
		backgroundColor: "#141718",
		borderRadius: 22,
		width: 44,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	sendDisabled: { opacity: 0.5 },
});
