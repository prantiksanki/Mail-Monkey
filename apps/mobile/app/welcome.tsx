import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function WelcomeScreen() {
	const router = useRouter();
	const insets = useSafeAreaInsets();

	// Log in / Sign up / Outlook go to the email-password screen for now.
	const toLogin = () => router.replace("/login");
	// Google is a temporary placeholder: drop straight into the app until real
	// Google OAuth is wired up.
	const enterApp = () => router.replace("/(tabs)");

	return (
		<View style={[styles.container, { paddingBottom: insets.bottom + 24 }]}>
			<View style={styles.hero}>
				<Text style={styles.title}>
					Welcome to{"\n"}
					<Text style={styles.titleStrong}>MailMonkey</Text>
				</Text>
			</View>

			<View style={styles.actions}>
				<Pressable style={styles.primaryBtn} onPress={toLogin}>
					<Text style={styles.primaryText}>Log in</Text>
				</Pressable>
				<Pressable style={styles.secondaryBtn} onPress={toLogin}>
					<Text style={styles.secondaryText}>Sign up</Text>
				</Pressable>

				<Text style={styles.continueLabel}>Continue With Accounts</Text>
				<View style={styles.accounts}>
					<Pressable
						style={[styles.account, styles.google]}
						onPress={enterApp}
					>
						<Text style={[styles.accountText, styles.googleText]}>
							Google
						</Text>
					</Pressable>
					<Pressable
						style={[styles.account, styles.outlook]}
						onPress={toLogin}
					>
						<Text style={[styles.accountText, styles.outlookText]}>
							Outlook
						</Text>
					</Pressable>
				</View>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#f7f8fa",
		paddingHorizontal: 25,
	},
	hero: { flex: 1, justifyContent: "center", alignItems: "center" },
	title: {
		fontSize: 40,
		fontWeight: "700",
		color: "#212121",
		textAlign: "center",
		lineHeight: 56,
	},
	titleStrong: { color: "#141718" },
	actions: { gap: 16 },
	primaryBtn: {
		backgroundColor: "#141718",
		borderRadius: 999,
		paddingVertical: 18,
		alignItems: "center",
		// green glow from the design (Button/Shadow 1)
		shadowColor: "#17ce92",
		shadowOffset: { width: 4, height: 8 },
		shadowOpacity: 0.25,
		shadowRadius: 12,
		elevation: 6,
	},
	primaryText: {
		color: "#fff",
		fontSize: 18,
		fontWeight: "700",
		letterSpacing: 0.2,
	},
	secondaryBtn: {
		backgroundColor: "#e3e3e3",
		borderRadius: 999,
		paddingVertical: 18,
		alignItems: "center",
	},
	secondaryText: { color: "#b1b1b1", fontSize: 17, fontWeight: "700" },
	continueLabel: {
		textAlign: "center",
		color: "#acadb9",
		fontSize: 16,
		fontWeight: "500",
		marginTop: 12,
	},
	accounts: { flexDirection: "row", gap: 14 },
	account: {
		flex: 1,
		height: 57,
		borderRadius: 10,
		alignItems: "center",
		justifyContent: "center",
	},
	google: { backgroundColor: "rgba(212,70,56,0.25)" },
	outlook: { backgroundColor: "rgba(66,103,178,0.25)" },
	accountText: {
		fontSize: 14,
		fontWeight: "600",
		letterSpacing: 2.55,
		textTransform: "uppercase",
	},
	googleText: { color: "#d44638" },
	outlookText: { color: "#4267b2" },
});
