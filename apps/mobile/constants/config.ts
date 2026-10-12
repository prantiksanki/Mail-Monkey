import Constants from "expo-constants";
import { Platform } from "react-native";

// Auto-derive the backend host from Expo's dev server host (Metro runs on the
// same laptop as the backend). This means the app follows your laptop's IP
// automatically — no need to hand-edit it every time the hotspot reassigns it.
function deriveBackendUrl(): string {
	// Web (browser): the backend runs on the same machine as the page.
	if (Platform.OS === "web" && typeof window !== "undefined") {
		return `http://${window.location.hostname}:3000`;
	}
	const hostUri =
		Constants.expoConfig?.hostUri ??
		// @ts-expect-error legacy field, present in Expo Go
		Constants.expoGoConfig?.debuggerHost ??
		"";
	const host = hostUri.split(":")[0];
	if (host) {
		return `http://${host}:3000`;
	}
	// Fallback if we can't read the dev host.
	return "http://10.96.1.176:3000";
}

export const BACKEND_URL = deriveBackendUrl();

export const API_BASE = `${BACKEND_URL}/api`;
export const AUTH_BASE = `${BACKEND_URL}/api/auth`;

// TEMPORARY dev login: paste a valid session token here to skip the login
// screen while we set up real Google sign-in. Leave "" for normal login.
// ⚠️ Do NOT commit a real token — clear this before pushing.
export const DEV_TOKEN = "";
