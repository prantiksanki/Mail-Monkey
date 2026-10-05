import * as SecureStore from "@/lib/secure-store";

const KEY = "avatar_variant";

export async function getAvatar(): Promise<number> {
	const v = await SecureStore.getItemAsync(KEY);
	return v ? Number(v) : 0;
}

export async function setAvatar(variant: number): Promise<void> {
	await SecureStore.setItemAsync(KEY, String(variant));
}
