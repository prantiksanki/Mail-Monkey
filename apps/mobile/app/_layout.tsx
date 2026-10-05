import {
	DarkTheme,
	DefaultTheme,
	ThemeProvider,
} from "@react-navigation/native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useColorScheme } from "@/hooks/use-color-scheme";
import { getToken } from "@/lib/auth";
import { FORCE_ONBOARDING_PREVIEW } from "@/lib/onboarding";

// Preview mode forces the flow on the FIRST launch only; after that the user
// can navigate into the app (e.g. Google → tabs) without being bounced back.
let previewRedirected = false;

export const unstable_settings = {
	anchor: "(tabs)",
};

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const router = useRouter();
	const segments = useSegments();
	const [ready, setReady] = useState(false);

	// Re-check the stored token on every navigation. Signed-out users enter the
	// splash → onboarding → welcome → login flow; a valid token sends them to
	// the app. Staying within the auth flow doesn't bounce.
	useEffect(() => {
		let active = true;
		getToken().then((token) => {
			if (!active) return;
			const AUTH_ROUTES = ["splash", "onboarding", "welcome", "login"];
			const inAuthFlow = AUTH_ROUTES.includes(segments[0] ?? "");
			if (FORCE_ONBOARDING_PREVIEW) {
				// Show the flow once on launch, then let navigation proceed
				// (so Google → app isn't bounced back to splash).
				if (!previewRedirected) {
					previewRedirected = true;
					if (!inAuthFlow) router.replace("/splash");
				}
			} else if (!token && !inAuthFlow) {
				router.replace("/splash");
			} else if (token && inAuthFlow) {
				router.replace("/(tabs)");
			}
			setReady(true);
		});
		return () => {
			active = false;
		};
	}, [segments]);

	if (!ready) return null;

	return (
		// Required for react-native-gesture-handler (calendar swipe navigation).
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<ThemeProvider
					value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
				>
				<Stack>
					<Stack.Screen
						name="(tabs)"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="splash"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="onboarding"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="welcome"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="login"
						options={{ headerShown: false }}
					/>
					<Stack.Screen
						name="chat/[email]"
						options={{ headerShown: true, title: "" }}
					/>
					<Stack.Screen
						name="email/[messageId]"
						options={{ headerShown: true, title: "" }}
					/>
					<Stack.Screen
						name="modal"
						options={{ presentation: "modal", title: "Modal" }}
					/>
				</Stack>
				<StatusBar style="auto" />
			</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
