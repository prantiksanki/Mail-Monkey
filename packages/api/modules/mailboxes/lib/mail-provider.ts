import { gmailProvider } from "./gmail-provider";
import { outlookProvider } from "./outlook-provider";

export type {
	ListMessagesOptions,
	ListMessagesResult,
	MailProvider,
} from "./mail-provider-types";

import type { MailProvider } from "./mail-provider-types";

export function getMailProvider(provider: "GOOGLE" | "OUTLOOK"): MailProvider {
	if (provider === "OUTLOOK") {
		return outlookProvider;
	}
	return gmailProvider;
}
