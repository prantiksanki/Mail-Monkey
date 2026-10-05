import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TextInput,
	View,
} from "react-native";
import {
	api,
	type CompiledRule,
	type Rule,
	type RuleSuggestion,
} from "@/lib/api";

function normalizeSuggestions(
	res: { suggestions?: RuleSuggestion[] } | RuleSuggestion[],
): RuleSuggestion[] {
	if (Array.isArray(res)) return res;
	return res?.suggestions ?? [];
}

function actionsSummary(rule: CompiledRule): string {
	return rule.actions
		.map(
			(a) =>
				a.type.replace(/_/g, " ").toLowerCase() +
				(a.label ? ` "${a.label}"` : "") +
				(a.to ? ` → ${a.to}` : ""),
		)
		.join(", ");
}

export default function RulesScreen() {
	const [mailboxId, setMailboxId] = useState<string | null>(null);
	const [rules, setRules] = useState<Rule[]>([]);
	const [suggestions, setSuggestions] = useState<RuleSuggestion[]>([]);
	const [loading, setLoading] = useState(true);

	const [prompt, setPrompt] = useState("");
	const [compiling, setCompiling] = useState(false);
	const [compiled, setCompiled] = useState<CompiledRule[] | null>(null);
	const [saving, setSaving] = useState(false);

	const load = useCallback(async () => {
		try {
			const mailboxes = await api.getMailboxes();
			if (!mailboxes.length) {
				setLoading(false);
				return;
			}
			const mb = mailboxes[0].id;
			setMailboxId(mb);
			const [rulesRes, suggRes] = await Promise.all([
				api.getRules(mb),
				api.getRuleSuggestions(mb).catch(() => [] as RuleSuggestion[]),
			]);
			setRules(rulesRes.rules ?? []);
			setSuggestions(normalizeSuggestions(suggRes));
		} catch {
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	async function compile() {
		if (!mailboxId || prompt.trim().length < 5) return;
		setCompiling(true);
		setCompiled(null);
		try {
			const res = await api.compileRule(mailboxId, prompt.trim());
			if (!res.rules?.length) {
				Alert.alert("Hmm", "Couldn't turn that into a rule. Try rephrasing.");
			} else {
				setCompiled(res.rules);
			}
		} catch (e) {
			Alert.alert("Error", e instanceof Error ? e.message : "Compile failed");
		} finally {
			setCompiling(false);
		}
	}

	async function save() {
		if (!mailboxId || !compiled) return;
		setSaving(true);
		try {
			for (const rule of compiled) {
				await api.createRule(mailboxId, { ...rule, enabled: true });
			}
			setCompiled(null);
			setPrompt("");
			await load();
		} catch (e) {
			Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
		} finally {
			setSaving(false);
		}
	}

	async function toggle(rule: Rule) {
		if (!mailboxId) return;
		const next = !rule.enabled;
		setRules((prev) =>
			prev.map((r) => (r.id === rule.id ? { ...r, enabled: next } : r)),
		);
		try {
			await api.toggleRule(mailboxId, rule.id, next);
		} catch {
			setRules((prev) =>
				prev.map((r) => (r.id === rule.id ? { ...r, enabled: !next } : r)),
			);
		}
	}

	if (loading) {
		return (
			<View style={styles.center}>
				<Stack.Screen options={{ title: "Rules" }} />
				<ActivityIndicator size="large" color="#141718" />
			</View>
		);
	}

	return (
		<ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
			<Stack.Screen options={{ title: "Rules" }} />

			{/* Create with AI */}
			<View style={styles.aiCard}>
				<View style={styles.aiHead}>
					<Ionicons name="sparkles" size={16} color="#8b5cf6" />
					<Text style={styles.aiTitle}>Create with AI</Text>
				</View>
				<TextInput
					style={styles.input}
					placeholder="Describe a rule in plain words, e.g. “archive newsletters and label receipts as Finance”"
					placeholderTextColor="#9aa0a6"
					value={prompt}
					onChangeText={setPrompt}
					multiline
				/>
				<Pressable
					style={[
						styles.compileBtn,
						(compiling || prompt.trim().length < 5) && styles.disabled,
					]}
					onPress={compile}
					disabled={compiling || prompt.trim().length < 5}
				>
					{compiling ? (
						<ActivityIndicator color="#fff" size="small" />
					) : (
						<Text style={styles.compileText}>Compile rule</Text>
					)}
				</Pressable>

				{compiled ? (
					<View style={styles.preview}>
						{compiled.map((r, i) => (
							<View key={i} style={styles.previewRule}>
								<Text style={styles.previewName}>{r.name}</Text>
								<Text style={styles.previewActions}>{actionsSummary(r)}</Text>
							</View>
						))}
						<View style={styles.previewButtons}>
							<Pressable
								style={styles.discard}
								onPress={() => setCompiled(null)}
							>
								<Text style={styles.discardText}>Discard</Text>
							</Pressable>
							<Pressable style={styles.saveBtn} onPress={save} disabled={saving}>
								{saving ? (
									<ActivityIndicator color="#fff" size="small" />
								) : (
									<Text style={styles.saveText}>Save rule</Text>
								)}
							</Pressable>
						</View>
					</View>
				) : null}
			</View>

			{/* Personalized suggestions */}
			{suggestions.length > 0 ? (
				<>
					<Text style={styles.section}>Suggested for your inbox</Text>
					{suggestions.slice(0, 5).map((s, i) => {
						const text = s.name ?? s.title ?? s.description ?? "Suggested rule";
						return (
							<Pressable
								key={s.id ?? String(i)}
								style={styles.suggestion}
								onPress={() => {
									setPrompt(text);
									setCompiled(null);
								}}
							>
								<Ionicons name="bulb-outline" size={18} color="#d97706" />
								<Text style={styles.suggestionText}>{text}</Text>
								<Ionicons name="add-circle-outline" size={20} color="#141718" />
							</Pressable>
						);
					})}
				</>
			) : null}

			{/* Active rules */}
			<Text style={styles.section}>Your rules</Text>
			{rules.length === 0 ? (
				<Text style={styles.muted}>No rules yet — create one above.</Text>
			) : (
				<View style={styles.group}>
					{rules.map((r, i) => (
						<View
							key={r.id}
							style={[styles.ruleRow, i === rules.length - 1 && { borderBottomWidth: 0 }]}
						>
							<Text style={styles.ruleName} numberOfLines={2}>
								{r.name}
							</Text>
							<Switch
								value={r.enabled}
								onValueChange={() => toggle(r)}
								trackColor={{ true: "#141718" }}
							/>
						</View>
					))}
				</View>
			)}
			<View style={{ height: 32 }} />
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	muted: { color: "#6b7280", fontSize: 15 },
	aiCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16 },
	aiHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
	aiTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
	input: {
		backgroundColor: "#f7f8fa",
		borderRadius: 12,
		padding: 12,
		fontSize: 15,
		color: "#111",
		minHeight: 70,
		textAlignVertical: "top",
	},
	compileBtn: {
		backgroundColor: "#8b5cf6",
		borderRadius: 12,
		paddingVertical: 12,
		alignItems: "center",
		marginTop: 10,
	},
	compileText: { color: "#fff", fontSize: 15, fontWeight: "600" },
	disabled: { opacity: 0.5 },
	preview: {
		marginTop: 14,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: "#e5e7eb",
		paddingTop: 12,
	},
	previewRule: {
		backgroundColor: "#f5f3ff",
		borderRadius: 10,
		padding: 12,
		marginBottom: 8,
	},
	previewName: { fontSize: 15, fontWeight: "600", color: "#111" },
	previewActions: { fontSize: 13, color: "#6b7280", marginTop: 3 },
	previewButtons: { flexDirection: "row", gap: 10, marginTop: 6 },
	discard: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#d1d5db",
		borderRadius: 10,
		paddingVertical: 11,
		alignItems: "center",
	},
	discardText: { color: "#6b7280", fontWeight: "600" },
	saveBtn: {
		flex: 1,
		backgroundColor: "#141718",
		borderRadius: 10,
		paddingVertical: 11,
		alignItems: "center",
	},
	saveText: { color: "#fff", fontWeight: "600" },
	section: {
		fontSize: 13,
		fontWeight: "600",
		color: "#9aa0a6",
		textTransform: "uppercase",
		marginTop: 24,
		marginBottom: 10,
	},
	suggestion: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		backgroundColor: "#fff",
		borderRadius: 12,
		padding: 14,
		marginBottom: 8,
	},
	suggestionText: { flex: 1, fontSize: 14, color: "#111" },
	group: { backgroundColor: "#fff", borderRadius: 16, overflow: "hidden" },
	ruleRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 14,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#ececef",
	},
	ruleName: { flex: 1, fontSize: 15, color: "#111", marginRight: 12 },
});
