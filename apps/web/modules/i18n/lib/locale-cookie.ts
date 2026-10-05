import "server-only";

import type { Locale } from "@repo/i18n";
import { config } from "@repo/i18n/config";
import { cookies } from "next/headers";

export async function getUserLocale() {
	const cookie = (await cookies()).get(config.localeCookieName);
	return cookie?.value ?? config.defaultLocale;
}

export async function setLocaleCookie(locale: Locale) {
	(await cookies()).set(config.localeCookieName, locale, {
		path: "/",
		sameSite: "lax",
		secure: process.env.NODE_ENV === "production",
	});
}
