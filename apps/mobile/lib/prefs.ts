import AsyncStorage from "@react-native-async-storage/async-storage";

// Simple JSON-backed preference store for local settings (notifications,
// appearance, language). Keyed under a single namespace.
export async function getPref<T>(key: string, fallback: T): Promise<T> {
	try {
		const v = await AsyncStorage.getItem(`pref:${key}`);
		return v ? (JSON.parse(v) as T) : fallback;
	} catch {
		return fallback;
	}
}

export async function setPref<T>(key: string, value: T): Promise<void> {
	await AsyncStorage.setItem(`pref:${key}`, JSON.stringify(value));
}
