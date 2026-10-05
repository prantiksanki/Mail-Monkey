import { Ionicons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect, useNavigation } from "expo-router";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import {
	ActivityIndicator,
	FlatList,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	type StyleProp,
	StyleSheet,
	Text,
	TextInput,
	type TextStyle,
	View,
} from "react-native";
import { getAiControls } from "@/lib/ai-prefs";
import { api, parseSender } from "@/lib/api";

// Capability blurbs shown on the empty state (Figma "Chatbox-UI v2").
const CAPABILITIES = [
	"Remembers what you said earlier in the conversation",
	"Allows you to provide follow-up corrections with AI",
	"Limited knowledge of world and events after 2021",
];

type Msg = {
	role: "user" | "assistant";
	content: string;
	sources?: { email_id: string; from: string; subject: string }[];
};

type Thread = { id: string; title: string; updatedAt: string };

function parseMentions(text: string): string[] {
	const m = text.match(/@([\p{L}\w.]+)/gu) ?? [];
	return [...new Set(m.map((x) => x.slice(1)))];
}

// Splits text on the `@name` token and wraps each mention in a styled <Text>
// so the highlight stays inline. Used both in chat bubbles and, live, inside
// the compose box (via <Text> children of the TextInput).
function highlightMentions(text: string, mentionStyle: StyleProp<TextStyle>) {
	return text.split(/(@[\p{L}\w.]+)/gu).map((part, i) =>
		/^@[\p{L}\w.]+$/u.test(part) ? (
			<Text key={i} style={mentionStyle}>
				{part}
			</Text>
		) : (
			part
		),
	);
}

export default function MonkeyChanScreen() {
	const headerHeight = useHeaderHeight();
	const navigation = useNavigation();
	const [mailboxId, setMailboxId] = useState<string | null>(null);
	const [contacts, setContacts] = useState<string[]>([]);
	const [threadId, setThreadId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Msg[]>([]);
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [historyOpen, setHistoryOpen] = useState(false);
	const [threads, setThreads] = useState<Thread[]>([]);
	const [aiEnabled, setAiEnabled] = useState(true);
	const listRef = useRef<FlatList>(null);

	// Respect the "MonkeyChan chat" toggle in Settings → AI Controls. Re-check
	// on focus so flipping it there takes effect when you return here.
	useFocusEffect(
		useCallback(() => {
			getAiControls().then((c) => setAiEnabled(c.monkeychan));
		}, []),
	);

	useEffect(() => {
		(async () => {
			try {
				const mbs = await api.getMailboxes();
				if (!mbs[0]) return;
				setMailboxId(mbs[0].id);
				const inbox = await api.getInbox(mbs[0].id, "all");
				const names = new Set<string>();
				for (const m of inbox.messages ?? []) {
					const { name } = parseSender(m.from);
					if (name) names.add(name.split(" ")[0]);
				}
				setContacts([...names].slice(0, 60));
			} catch {}
		})();
	}, []);

	const startNew = useCallback(() => {
		setThreadId(null);
		setMessages([]);
		setHistoryOpen(false);
	}, []);

	const openHistory = useCallback(async () => {
		if (mailboxId) {
			try {
				const r = await api.listChatThreads(mailboxId);
				setThreads(r.threads);
			} catch {}
		}
		setHistoryOpen(true);
	}, [mailboxId]);

	useLayoutEffect(() => {
		navigation.setOptions({
			// Title lives in the screen body (big "MonkeyChan"), so keep the
			// header bar (icons) but drop its centered title.
			headerTitle: () => null,
			headerLeft: () => (
				<Pressable
					onPress={openHistory}
					hitSlop={10}
					style={{ marginLeft: 20 }}
				>
					<Ionicons name="time-outline" size={22} color="#111" />
				</Pressable>
			),
			headerRight: () => (
				<Pressable
					onPress={startNew}
					hitSlop={10}
					style={{ marginRight: 20 }}
				>
					<Ionicons name="create-outline" size={22} color="#111" />
				</Pressable>
			),
		});
	}, [navigation, openHistory, startNew]);

	const mentionMatch = input.match(/@([\p{L}\w.]*)$/u);
	const suggestions = mentionMatch
		? contacts
				.filter((c) =>
					c.toLowerCase().startsWith(mentionMatch[1].toLowerCase()),
				)
				.slice(0, 5)
		: [];

	async function send() {
		const question = input.trim();
		if (!question || !mailboxId || sending) return;
		setMessages((m) => [...m, { role: "user", content: question }]);
		setInput("");
		setSending(true);
		setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
		try {
			const res = await api.mailChat(mailboxId, {
				question,
				threadId: threadId ?? undefined,
				mentions: parseMentions(question),
			});
			setThreadId(res.threadId);
			setMessages((m) => [
				...m,
				{
					role: "assistant",
					content: res.answer,
					sources: res.sources,
				},
			]);
		} catch (e) {
			setMessages((m) => [
				...m,
				{
					role: "assistant",
					content:
						e instanceof Error
							? `Error: ${e.message}`
							: "Something went wrong.",
				},
			]);
		} finally {
			setSending(false);
			setTimeout(
				() => listRef.current?.scrollToEnd({ animated: true }),
				50,
			);
		}
	}

	async function loadThread(t: Thread) {
		if (!mailboxId) return;
		setHistoryOpen(false);
		try {
			const r = await api.getChatThread(mailboxId, t.id);
			setThreadId(t.id);
			setMessages(
				r.messages.map((m) => ({
					role: m.role === "user" ? "user" : "assistant",
					content: m.content,
					sources: Array.isArray(m.sources)
						? (m.sources as Msg["sources"])
						: undefined,
				})),
			);
		} catch {}
	}

	if (!aiEnabled) {
		return (
			<View style={styles.offScreen}>
				<Ionicons
					name="chatbubbles-outline"
					size={44}
					color="#c4c7cc"
				/>
				<Text style={styles.offTitle}>MonkeyChan is off</Text>
				<Text style={styles.offText}>
					Turn on “MonkeyChan chat” in Settings → AI Controls to ask
					questions about your mailbox.
				</Text>
			</View>
		);
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : "height"}
			keyboardVerticalOffset={headerHeight}
		>
			{messages.length === 0 ? (
				<View style={styles.empty}>
					<Text style={styles.emptyTitle}>MonkeyChan</Text>
					<View style={styles.cards}>
						{CAPABILITIES.map((c) => (
							<View key={c} style={styles.card}>
								<Text style={styles.cardText}>{c}</Text>
							</View>
						))}
					</View>
				</View>
			) : (
				<FlatList
					ref={listRef}
					data={messages}
					keyExtractor={(_, i) => String(i)}
					contentContainerStyle={{ padding: 14 }}
					renderItem={({ item }) => (
						<View
							style={[
								styles.bubble,
								item.role === "user"
									? styles.userBubble
									: styles.botBubble,
							]}
						>
							<Text
								style={
									item.role === "user"
										? styles.userText
										: styles.botText
								}
							>
								{highlightMentions(
									item.content,
									item.role === "user"
										? styles.mentionUser
										: styles.mentionBot,
								)}
							</Text>
							{item.sources && item.sources.length > 0 ? (
								<View style={styles.sources}>
									{item.sources.slice(0, 3).map((s, i) => (
										<Text
											key={i}
											style={styles.sourceText}
											numberOfLines={1}
										>
											• {s.subject}
										</Text>
									))}
								</View>
							) : null}
						</View>
					)}
				/>
			)}

			{sending ? (
				<View style={styles.typing}>
					<ActivityIndicator size="small" color="#141718" />
					<Text style={styles.typingText}>Reading your mail…</Text>
				</View>
			) : null}

			{suggestions.length > 0 ? (
				<View style={styles.suggestions}>
					{suggestions.map((s) => (
						<Pressable
							key={s}
							style={styles.suggestion}
							onPress={() =>
								setInput(
									input.replace(/@([\p{L}\w.]*)$/u, `@${s} `),
								)
							}
						>
							<Text style={styles.suggestionText}>@{s}</Text>
						</Pressable>
					))}
				</View>
			) : null}

			<View style={styles.inputBar}>
				<TextInput
					style={styles.input}
					placeholder="Send a message."
					placeholderTextColor="#9aa0a6"
					onChangeText={setInput}
					multiline
				>
					{/* Rendering the value as <Text> children (instead of the
					    `value` prop) lets us color @mentions live while typing.
					    Empty → no children so the placeholder still shows. */}
					{input.length > 0 ? (
						<Text style={styles.inputText}>
							{highlightMentions(input, styles.mentionInput)}
						</Text>
					) : null}
				</TextInput>
				<Pressable
					style={styles.sendBtn}
					onPress={send}
					disabled={!input.trim() || sending}
					hitSlop={8}
				>
					<Ionicons
							name="send"
							size={20}
							color={!input.trim() || sending ? "#c9ccd4" : "#141718"}
						/>
				</Pressable>
			</View>

			<Modal
				visible={historyOpen}
				animationType="slide"
				onRequestClose={() => setHistoryOpen(false)}
			>
				<View style={styles.historyHeader}>
					<Text style={styles.historyTitle}>Chats</Text>
					<Pressable
						onPress={() => setHistoryOpen(false)}
						hitSlop={10}
					>
						<Ionicons name="close" size={24} color="#111" />
					</Pressable>
				</View>
				<Pressable style={styles.newChat} onPress={startNew}>
					<Ionicons name="add" size={20} color="#141718" />
					<Text style={styles.newChatText}>New chat</Text>
				</Pressable>
				<FlatList
					data={threads}
					keyExtractor={(t) => t.id}
					renderItem={({ item }) => (
						<Pressable
							style={styles.threadRow}
							onPress={() => loadThread(item)}
						>
							<Ionicons
								name="chatbubble-outline"
								size={18}
								color="#6b7280"
							/>
							<Text style={styles.threadTitle} numberOfLines={1}>
								{item.title}
							</Text>
						</Pressable>
					)}
					ListEmptyComponent={
						<Text style={styles.noThreads}>
							No saved chats yet.
						</Text>
					}
				/>
			</Modal>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	offScreen: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
		padding: 32,
		gap: 10,
		backgroundColor: "#fff",
	},
	offTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
	offText: {
		fontSize: 14,
		color: "#6b7280",
		textAlign: "center",
		lineHeight: 20,
	},
	// Anchored to the top so the title + cards stay put when the keyboard
	// opens (only the send box rises with it).
	empty: {
		flex: 1,
		alignItems: "center",
		justifyContent: "flex-start",
		paddingTop: 70,
		paddingHorizontal: 30,
	},
	emptyTitle: {
		fontSize: 36,
		fontWeight: "700",
		color: "#757474",
		letterSpacing: -0.5,
		marginBottom: 36,
	},
	cards: { width: "100%", gap: 14 },
	card: {
		backgroundColor: "#f7f7f8",
		borderRadius: 14,
		paddingVertical: 18,
		paddingHorizontal: 18,
	},
	cardText: {
		fontSize: 15,
		color: "#a0a0a5",
		fontWeight: "500",
		textAlign: "center",
		lineHeight: 22,
	},
	bubble: {
		maxWidth: "88%",
		borderRadius: 16,
		padding: 12,
		marginBottom: 10,
	},
	userBubble: {
		alignSelf: "flex-end",
		backgroundColor: "#141718",
		borderTopRightRadius: 4,
	},
	botBubble: {
		alignSelf: "flex-start",
		backgroundColor: "#f1f3f5",
		borderTopLeftRadius: 4,
	},
	userText: { color: "#fff", fontSize: 15, lineHeight: 21 },
	botText: { color: "#1f2937", fontSize: 15, lineHeight: 21 },
	// @mention emphasis: amber on the blue user bubble, app-blue on the gray bot bubble.
	mentionUser: { color: "#e6e8ec", fontWeight: "800" },
	mentionBot: { color: "#141718", fontWeight: "800" },
	// Compose box: base text matches the input, mentions go bold app-blue live.
	inputText: { color: "#111", fontSize: 15 },
	mentionInput: { color: "#141718", fontWeight: "700" },
	sources: {
		marginTop: 8,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#d9dde1",
		paddingTop: 6,
	},
	sourceText: { fontSize: 12, color: "#6b7280", marginTop: 2 },
	typing: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 16,
		paddingBottom: 6,
	},
	typingText: { fontSize: 13, color: "#9aa0a6" },
	suggestions: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: 8,
		paddingHorizontal: 12,
		paddingBottom: 8,
	},
	suggestion: {
		backgroundColor: "#f1f3f5",
		borderRadius: 14,
		paddingHorizontal: 12,
		paddingVertical: 6,
	},
	suggestionText: { color: "#141718", fontSize: 14, fontWeight: "600" },
	// Bordered "Send a message." box from the Figma (Chatbox-UI v2).
	inputBar: {
		flexDirection: "row",
		alignItems: "center",
		marginHorizontal: 16,
		marginBottom: 10,
		paddingLeft: 16,
		paddingRight: 10,
		borderWidth: 1,
		borderColor: "#e1e1e1",
		borderRadius: 14,
		backgroundColor: "#fff",
	},
	input: {
		flex: 1,
		maxHeight: 120,
		paddingVertical: 12,
		fontSize: 16,
		color: "#111",
		marginRight: 8,
	},
	sendBtn: {
		width: 36,
		height: 36,
		alignItems: "center",
		justifyContent: "center",
	},
	historyHeader: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 18,
		paddingTop: 56,
	},
	historyTitle: { fontSize: 20, fontWeight: "700", color: "#111" },
	newChat: {
		flexDirection: "row",
		alignItems: "center",
		gap: 8,
		paddingHorizontal: 18,
		paddingVertical: 12,
	},
	newChatText: { color: "#141718", fontSize: 16, fontWeight: "600" },
	threadRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
		paddingHorizontal: 18,
		paddingVertical: 14,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#eee",
	},
	threadTitle: { flex: 1, fontSize: 15, color: "#111" },
	noThreads: { textAlign: "center", color: "#9aa0a6", marginTop: 40 },
});
