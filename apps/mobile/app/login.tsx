import { useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	StyleSheet,
	Text,
	TextInput,
	View,
} from "react-native";
import { signIn } from "@/lib/auth";

export default function LoginScreen() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleLogin() {
		setError(null);
		setLoading(true);
		try {
			await signIn(email.trim(), password);
			router.replace("/(tabs)");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Login failed");
		} finally {
			setLoading(false);
		}
	}

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<View style={styles.inner}>
				<Text style={styles.logo}>MailMonkey</Text>
				<Text style={styles.tagline}>Your inbox, as a chat.</Text>

				<TextInput
					style={styles.input}
					placeholder="Email"
					placeholderTextColor="#9aa0a6"
					autoCapitalize="none"
					keyboardType="email-address"
					value={email}
					onChangeText={setEmail}
				/>
				<TextInput
					style={styles.input}
					placeholder="Password"
					placeholderTextColor="#9aa0a6"
					secureTextEntry
					value={password}
					onChangeText={setPassword}
				/>

				{error ? <Text style={styles.error}>{error}</Text> : null}

				<Pressable
					style={[styles.button, loading && styles.buttonDisabled]}
					onPress={handleLogin}
					disabled={loading}
				>
					{loading ? (
						<ActivityIndicator color="#fff" />
					) : (
						<Text style={styles.buttonText}>Sign in</Text>
					)}
				</Pressable>
			</View>
		</KeyboardAvoidingView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#fff" },
	inner: { flex: 1, justifyContent: "center", paddingHorizontal: 28 },
	logo: { fontSize: 34, fontWeight: "700", color: "#111", textAlign: "center" },
	tagline: {
		fontSize: 15,
		color: "#6b7280",
		textAlign: "center",
		marginTop: 6,
		marginBottom: 36,
	},
	input: {
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
		fontSize: 16,
		color: "#111",
		marginBottom: 12,
		backgroundColor: "#fafafa",
	},
	button: {
		backgroundColor: "#141718",
		borderRadius: 12,
		paddingVertical: 15,
		alignItems: "center",
		marginTop: 8,
	},
	buttonDisabled: { opacity: 0.6 },
	buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
	error: { color: "#dc2626", fontSize: 14, marginBottom: 8, textAlign: "center" },
});
