import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { api } from "@/lib/api";

export default function ComposeScreen() {
	const router = useRouter();
	const [mailboxId, setMailboxId] = useState<string | null>(null);
	const [to, setTo] = useState("");
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [sending, setSending] = useState(false);

	useEffect(() => {
		api.getMailboxes()
			.then((m) => m[0] && setMailboxId(m[0].id))
			.catch(() => {});
	}, []);

	async function handleSend() {
		if (!mailboxId || !to.trim() || !body.trim()) {
			Alert.alert("Missing info", "Add a recipient and a message.");
			return;
		}
		setSending(true);
		try {
			await api.send(mailboxId, {
				to: to.trim(),
				subject: subject.trim() || "(no subject)",
				body: body.trim(),
			});
			router.back();
		} catch (e) {
			Alert.alert(
				"Error",
				e instanceof Error ? e.message : "Failed to send",
			);
			setSending(false);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<Stack.Screen
				options={{
					title: "New message",
					headerRight: () => (
						<Pressable onPress={handleSend} disabled={sending}>
							{sending ? (
								<ActivityIndicator color="#141718" />
							) : (
								<Text style={styles.sendHeader}>Send</Text>
							)}
						</Pressable>
					),
				}}
			/>
			<View style={styles.field}>
				<Text style={styles.label}>To</Text>
				<TextInput
					style={styles.input}
					placeholder="name@example.com"
					placeholderTextColor="#9aa0a6"
					autoCapitalize="none"
					keyboardType="email-address"
					value={to}
					onChangeText={setTo}
				/>
			</View>
			<View style={styles.field}>
				<Text style={styles.label}>Subject</Text>
				<TextInput
					style={styles.input}
					placeholder="Subject"
					placeholderTextColor="#9aa0a6"
					value={subject}
					onChangeText={setSubject}
				/>
			</View>
			<TextInput
				style={styles.bodyInput}
				placeholder="Write your message…"
				placeholderTextColor="#9aa0a6"
				value={body}
				onChangeText={setBody}
				multiline
				textAlignVertical="top"
			/>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	sendHeader: { color: "#141718", fontSize: 16, fontWeight: "600" },
	field: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 16,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: "#e5e7eb",
	},
	label: { width: 64, fontSize: 15, color: "#6b7280" },
	input: { flex: 1, paddingVertical: 14, fontSize: 15, color: "#111" },
	bodyInput: {
		flex: 1,
		padding: 16,
		fontSize: 15,
		color: "#111",
		lineHeight: 22,
	},
});
