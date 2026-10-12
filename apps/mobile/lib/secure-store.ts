import * as ExpoSecureStore from "expo-secure-store";
import { Platform } from "react-native";

// expo-secure-store has no web implementation, so fall back to localStorage in
// the browser. Native (iOS/Android) keeps using the real secure store.
const isWeb = Platform.OS === "web";

export async function getItemAsync(key: string): Promise<string | null> {
	if (!isWeb) {
		return ExpoSecureStore.getItemAsync(key);
	}
	try {
		return window.localStorage.getItem(key);
	} catch {
		return null;
	}
}

export async function setItemAsync(key: string, value: string): Promise<void> {
	if (!isWeb) {
		return ExpoSecureStore.setItemAsync(key, value);
	}
	try {
		window.localStorage.setItem(key, value);
	} catch {}
}

export async function deleteItemAsync(key: string): Promise<void> {
	if (!isWeb) {
		return ExpoSecureStore.deleteItemAsync(key);
	}
	try {
		window.localStorage.removeItem(key);
	} catch {}
}
