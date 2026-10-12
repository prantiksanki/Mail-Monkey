import { getUserLocale } from "@i18n/lib/locale-cookie";
import { routing } from "@i18n/routing";
import { getMessagesForLocale } from "@repo/i18n";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ requestLocale }) => {
	let locale = await requestLocale;

	if (!locale) {
		locale = await getUserLocale();
	}

	if (!routing.locales.includes(locale)) {
		locale = routing.defaultLocale;
	}

	return {
		locale,
		// Provide a stable `now` so next-intl serializes the server value to the
		// client (inherited by NextIntlClientProvider), keeping useNow()/date
		// formatting hydration-safe.
		now: new Date(),
		messages: await getMessagesForLocale(locale),
	};
});
