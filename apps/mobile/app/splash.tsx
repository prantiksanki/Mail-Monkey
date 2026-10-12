import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getToken } from "@/lib/auth";
import { FORCE_ONBOARDING_PREVIEW, getOnboarded } from "@/lib/onboarding";

// Boot screen (Figma "Splash V2", node 1:28) — just the wordmark, no logo.
// Shows briefly, then routes: signed in → app, first launch → onboarding,
// otherwise → welcome.
const MIN_MS = 1500;

export default function SplashScreen() {
	const router = useRouter();

	useEffect(() => {
		let active = true;
		const started = Date.now();
		(async () => {
			const [token, onboarded] = await Promise.all([
				getToken(),
				getOnboarded(),
			]);
			const wait = Math.max(0, MIN_MS - (Date.now() - started));
			setTimeout(() => {
				if (!active) {
					return;
				}
				// DEV preview: always show onboarding, ignoring token/flag.
				if (FORCE_ONBOARDING_PREVIEW) {
					router.replace("/onboarding");
				} else if (token) {
					router.replace("/(tabs)");
				} else if (!onboarded) {
					router.replace("/onboarding");
				} else {
					router.replace("/welcome");
				}
			}, wait);
		})();
		return () => {
			active = false;
		};
	}, [router]);

	return (
		<View style={styles.container}>
			<View style={styles.center}>
				<Text style={styles.name}>MailMonkey</Text>
			</View>
			<View style={styles.footer}>
				<Text style={styles.version}>Version 1.0</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, backgroundColor: "#f7f8fa" },
	center: { flex: 1, alignItems: "center", justifyContent: "center" },
	footer: { alignItems: "center", paddingBottom: 56 },
	name: {
		fontSize: 35,
		fontWeight: "600",
		color: "#000",
		letterSpacing: -0.7,
	},
	version: { fontSize: 14, color: "#757171" },
});
