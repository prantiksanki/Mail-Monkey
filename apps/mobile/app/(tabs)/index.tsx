import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	FlatList,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { getAiControls } from "@/lib/ai-prefs";
import { api, type EmailAi, type InboxMessage, parseSender } from "@/lib/api";

const FOLDERS = ["inbox", "sent", "all", "trash", "spam"] as const;
type Folder = (typeof FOLDERS)[number];

const FOLDER_LABEL: Record<Folder, string> = {
	inbox: "Inbox",
	sent: "Sent",
	all: "All",
	trash: "Trash",
	spam: "Spam",
};

// System labels we don't surface as category chips.
const HIDDEN_LABELS = new Set([
	"INBOX",
	"SENT",
	"UNREAD",
	"IMPORTANT",
	"STARRED",
	"DRAFT",
	"TRASH",
	"SPAM",
	"CHAT",
]);

function prettyLabel(id: string): string {
	if (id.startsWith("CATEGORY_")) {
		const s = id.slice("CATEGORY_".length).toLowerCase();
		return s.charAt(0).toUpperCase() + s.slice(1);
	}
	return id;
}

function labelChips(labelIds?: string[]): string[] {
	if (!labelIds) {
		return [];
	}
	return labelIds
		.filter((l) => !HIDDEN_LABELS.has(l))
		.map(prettyLabel)
		.slice(0, 2);
}

type AiChip = { name: string; color: string };

type Contact = {
	email: string;
	name: string;
	latestSubject: string;
	latestSnippet: string;
	date: string;
	unreadCount: number;
	labels: AiChip[];
	priority: string | null;
};

function groupBySender(
	messages: InboxMessage[],
	aiMap: Map<string, EmailAi>,
	opts: { summaries: boolean; labels: boolean },
): Contact[] {
	const map = new Map<string, Contact>();
	for (const m of messages) {
		const { name, email } = parseSender(m.from);
		const existing = map.get(email);
		if (existing) {
			if (m.isUnread) {
				existing.unreadCount += 1;
			}
		} else {
			const ai = aiMap.get(m.id);
			// AI summary/labels only when the user has those toggles on.
			const labels: AiChip[] = !opts.labels
				? []
				: ai?.labels?.length
					? ai.labels.map((l) => ({ name: l.name, color: l.color }))
					: labelChips(m.labelIds).map((n) => ({
							name: n,
							color: "#4f46e5",
						}));
			const snippet =
				opts.summaries && ai?.aiSummary ? ai.aiSummary : m.snippet;
			map.set(email, {
				email,
				name,
				latestSubject: m.subject,
				latestSnippet: snippet,
				date: m.date,
				unreadCount: m.isUnread ? 1 : 0,
				labels,
				priority: opts.labels ? (ai?.aiPriority ?? null) : null,
			});
		}
	}
	return Array.from(map.values());
}

function timeAgo(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) {
		return "now";
	}
	if (mins < 60) {
		return `${mins}m`;
	}
	const hours = Math.floor(mins / 60);
	if (hours < 24) {
		return `${hours}h`;
	}
	const days = Math.floor(hours / 24);
	if (days < 7) {
		return `${days}d`;
	}
	return new Date(iso).toLocaleDateString();
}

function avatarColor(email: string): string {
	const colors = [
		"#141718",
		"#22a06b",
		"#e0803a",
		"#8b5cf6",
		"#dc4d6b",
		"#0ea5b7",
	];
	let h = 0;
	for (let i = 0; i < email.length; i++) {
		h = email.charCodeAt(i) + ((h << 5) - h);
	}
	return colors[Math.abs(h) % colors.length];
}

export default function ChatsScreen() {
	const router = useRouter();
	const [mailboxId, setMailboxId] = useState<string | null>(null);
	const [folder, setFolder] = useState<Folder>("inbox");
	const [search, setSearch] = useState("");
	const [contacts, setContacts] = useState<Contact[]>([]);
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const load = useCallback(
		async (f: Folder, q?: string) => {
			setError(null);
			try {
				let mb = mailboxId;
				if (!mb) {
					const mailboxes = await api.getMailboxes();
					if (!mailboxes.length) {
						setError(
							"No mailbox connected. Connect one in the web app.",
						);
						setLoading(false);
						return;
					}
					mb = mailboxes[0].id;
					setMailboxId(mb);
				}
				const inbox = await api.getInbox(mb, f, q || undefined);
				const controls = await getAiControls();
				// Merge AI enrichment (labels + insight) by email id — only if the
				// user has at least one of those AI surfaces enabled.
				let aiMap = new Map<string, EmailAi>();
				if (controls.summaries || controls.labels) {
					try {
						const ai = await api.getMailboxAi(mb);
						aiMap = new Map(ai.items.map((x) => [x.emailId, x]));
					} catch {}
				}
				setContacts(
					groupBySender(inbox.messages ?? [], aiMap, {
						summaries: controls.summaries,
						labels: controls.labels,
					}),
				);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Failed to load");
			} finally {
				setLoading(false);
			}
		},
		[mailboxId],
	);

	// Keep latest folder/search accessible inside the stable poll interval.
	const folderRef = useRef(folder);
	folderRef.current = folder;
	const searchRef = useRef(search);
	searchRef.current = search;
	// Guard so syncs never overlap (a Gmail sync can take 10s+).
	const syncingRef = useRef(false);

	useEffect(() => {
		load(folder, search);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [folder]);

	// Pull new mail from Gmail, but never overlap with an in-flight sync.
	const syncOnce = useCallback(async () => {
		if (!mailboxId || syncingRef.current) {
			return;
		}
		syncingRef.current = true;
		try {
			await api.syncRecent(mailboxId);
		} catch {
		} finally {
			syncingRef.current = false;
		}
	}, [mailboxId]);

	// Once we know the mailbox: sync now, then every 2 min (skipping if a sync
	// is still running) so new mail shows without piling up requests.
	useEffect(() => {
		if (!mailboxId) {
			return;
		}
		let cancelled = false;
		const tick = async () => {
			await syncOnce();
			if (!cancelled) {
				load(folderRef.current, searchRef.current);
			}
		};
		tick();
		const id = setInterval(tick, 120000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mailboxId]);

	const onRefresh = useCallback(async () => {
		setRefreshing(true);
		await syncOnce();
		await load(folder, search);
		setRefreshing(false);
	}, [load, folder, search, syncOnce]);

	function runSearch() {
		setLoading(true);
		load(folder, search);
	}

	return (
		<View style={styles.container}>
			{/* Search */}
			<View style={styles.searchRow}>
				<Ionicons name="search" size={18} color="#9aa0a6" />
				<TextInput
					style={styles.searchInput}
					placeholder="Search mail…"
					placeholderTextColor="#9aa0a6"
					value={search}
					onChangeText={setSearch}
					onSubmitEditing={runSearch}
					returnKeyType="search"
				/>
				{search ? (
					<Pressable
						onPress={() => {
							setSearch("");
							setLoading(true);
							load(folder, "");
						}}
					>
						<Ionicons
							name="close-circle"
							size={18}
							color="#9aa0a6"
						/>
					</Pressable>
				) : null}
			</View>

			{/* Folder tabs */}
			<View style={styles.folderRowWrap}>
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.folderRow}
				>
					{FOLDERS.map((f) => (
						<Pressable
							key={f}
							onPress={() => {
								setLoading(true);
								setFolder(f);
							}}
							style={[
								styles.chip,
								folder === f && styles.chipActive,
							]}
						>
							<Text
								style={[
									styles.chipText,
									folder === f && styles.chipTextActive,
								]}
							>
								{FOLDER_LABEL[f]}
							</Text>
						</Pressable>
					))}
				</ScrollView>
			</View>

			{loading ? (
				<View style={styles.center}>
					<ActivityIndicator size="large" color="#141718" />
				</View>
			) : error ? (
				<View style={styles.center}>
					<Text style={styles.errorText}>{error}</Text>
				</View>
			) : (
				<FlatList
					data={contacts}
					keyExtractor={(c) => c.email}
					refreshControl={
						<RefreshControl
							refreshing={refreshing}
							onRefresh={onRefresh}
						/>
					}
					ListEmptyComponent={
						<View style={styles.center}>
							<Text style={styles.errorText}>Nothing here.</Text>
						</View>
					}
					renderItem={({ item }) => (
						<Pressable
							style={styles.row}
							onPress={() =>
								router.push({
									pathname: "/chat/[email]",
									params: {
										email: item.email,
										name: item.name,
										mailboxId: mailboxId ?? "",
									},
								})
							}
						>
							<View
								style={[
									styles.avatar,
									{
										backgroundColor: avatarColor(
											item.email,
										),
									},
								]}
							>
								<Text style={styles.avatarText}>
									{(item.name || item.email)
										.charAt(0)
										.toUpperCase()}
								</Text>
							</View>
							<View style={styles.rowBody}>
								<View style={styles.rowTop}>
									<Text style={styles.name} numberOfLines={1}>
										{item.name}
									</Text>
									{item.priority === "HANDLE_NOW" ? (
										<View style={styles.needsYou}>
											<Text style={styles.needsYouText}>
												Needs you
											</Text>
										</View>
									) : null}
									<Text style={styles.time}>
										{timeAgo(item.date)}
									</Text>
								</View>
								<Text style={styles.subject} numberOfLines={1}>
									{item.latestSubject}
								</Text>
								<View style={styles.rowBottom}>
									<Text
										style={styles.snippet}
										numberOfLines={1}
									>
										{item.latestSnippet}
									</Text>
								</View>
								{item.labels.length > 0 ? (
									<View style={styles.labelRow}>
										{item.labels.map((l) => (
											<View
												key={l.name}
												style={[
													styles.labelChip,
													{
														backgroundColor: `${l.color}1a`,
													},
												]}
											>
												<Text
													style={[
														styles.labelChipText,
														{ color: l.color },
													]}
												>
													{l.name}
												</Text>
											</View>
										))}
									</View>
								) : null}
							</View>
							{item.unreadCount > 0 ? (
								<View style={styles.badge}>
									<Text style={styles.badgeText}>
										{item.unreadCount}
									</Text>
								</View>
							) : null}
						</Pressable>
					)}
				/>
			)}

			{/* Compose FAB */}
			<Pressable
				style={styles.fab}
				onPress={() => router.push("/compose")}
			>
				<Ionicons name="create" size={24} color="#fff" />
			</Pressable>
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
	errorText: { color: "#6b7280", fontSize: 15, textAlign: "center" },
	searchRow: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#f1f3f5",
		borderRadius: 10,
		marginHorizontal: 12,
		marginTop: 8,
		paddingHorizontal: 12,
		gap: 8,
	},
	searchInput: { flex: 1, paddingVertical: 9, fontSize: 15, color: "#111" },
	folderRowWrap: { paddingVertical: 8 },
	folderRow: { paddingHorizontal: 12, gap: 8, paddingLeft: 12 },
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 6,
		borderRadius: 16,
		backgroundColor: "#f1f3f5",
		marginRight: 8,
	},
	chipActive: { backgroundColor: "#141718" },
	chipText: { fontSize: 14, color: "#374151", fontWeight: "500" },
	chipTextActive: { color: "#fff" },
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#e5e7eb",
	},
	avatar: {
		width: 48,
		height: 48,
		borderRadius: 24,
		alignItems: "center",
		justifyContent: "center",
		marginRight: 12,
	},
	avatarText: { color: "#fff", fontSize: 20, fontWeight: "600" },
	rowBody: { flex: 1 },
	rowTop: { flexDirection: "row", alignItems: "center" },
	needsYou: {
		backgroundColor: "#fee2e2",
		borderRadius: 6,
		paddingHorizontal: 6,
		paddingVertical: 1,
		marginRight: 6,
	},
	needsYouText: { fontSize: 10, color: "#dc2626", fontWeight: "700" },
	name: {
		fontSize: 16,
		fontWeight: "600",
		color: "#111",
		flex: 1,
		marginRight: 8,
	},
	time: { fontSize: 12, color: "#9aa0a6" },
	subject: { fontSize: 14, color: "#374151", marginTop: 2 },
	rowBottom: { flexDirection: "row", alignItems: "center" },
	snippet: { fontSize: 13, color: "#9aa0a6", marginTop: 1, flex: 1 },
	labelRow: { flexDirection: "row", gap: 6, marginTop: 5 },
	labelChip: {
		backgroundColor: "#eef2ff",
		borderRadius: 6,
		paddingHorizontal: 7,
		paddingVertical: 2,
	},
	labelChipText: { fontSize: 11, color: "#4f46e5", fontWeight: "600" },
	badge: {
		backgroundColor: "#141718",
		minWidth: 22,
		height: 22,
		borderRadius: 11,
		alignItems: "center",
		justifyContent: "center",
		marginLeft: 8,
		paddingHorizontal: 6,
	},
	badgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
	fab: {
		position: "absolute",
		right: 20,
		bottom: 24,
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: "#141718",
		alignItems: "center",
		justifyContent: "center",
		shadowColor: "#000",
		shadowOpacity: 0.2,
		shadowRadius: 6,
		shadowOffset: { width: 0, height: 3 },
		elevation: 5,
	},
});
