import deepmerge from "deepmerge";
import { config } from "../config";
import type { Messages } from "../types";

export const importLocale = async (locale: string): Promise<Messages> => {
	// Defensive allowlist check — callers already validate/type-constrain
	// `locale` before calling this, but since dynamic import() can execute
	// code (not just read data), this function must not trust an unvalidated
	// string on its own: an unchecked `locale` here would allow path
	// traversal escalated to arbitrary module execution.
	if (!(locale in config.locales)) {
		throw new Error(`Unknown locale: ${locale}`);
	}
	return (await import(`../translations/${locale}.json`)).default as Messages;
};

export const getMessagesForLocale = async (
	locale: string,
): Promise<Messages> => {
	const localeMessages = await importLocale(locale);
	if (locale === config.defaultLocale) {
		return localeMessages;
	}
	const defaultLocaleMessages = await importLocale(config.defaultLocale);
	return deepmerge(defaultLocaleMessages, localeMessages);
};
