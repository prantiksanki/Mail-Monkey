import * as SecureStore from "@/lib/secure-store";
import { AUTH_BASE, DEV_TOKEN } from "@/constants/config";

const TOKEN_KEY = "zeromail_token";

// Sign in with email + password. The backend's Better Auth `bearer` plugin
// returns a session token in the `set-auth-token` response header, which we
// store securely and send as `Authorization: Bearer <token>` on API calls.
export async function signIn(email: string, password: string): Promise<void> {
	const res = await fetch(`${AUTH_BASE}/sign-in/email`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
	});

	if (!res.ok) {
		let message = `Login failed (${res.status})`;
		try {
			const body = await res.json();
			if (body?.message) message = body.message;
		} catch {}
		throw new Error(message);
	}

	const token =
		res.headers.get("set-auth-token") ?? res.headers.get("Set-Auth-Token");
	if (!token) {
		throw new Error("Server did not return an auth token.");
	}
	await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
	if (DEV_TOKEN) return DEV_TOKEN;
	return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function signOut(): Promise<void> {
	await SecureStore.deleteItemAsync(TOKEN_KEY);
}
