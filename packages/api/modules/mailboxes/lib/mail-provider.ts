import { gmailProvider } from "./gmail-provider";
import { imapProvider } from "./imap-provider";
import { outlookProvider } from "./outlook-provider";

export type {
	ListMessagesOptions,
	ListMessagesResult,
	MailProvider,
} from "./mail-provider-types";

import type { MailProvider } from "./mail-provider-types";

export function getMailProvider(
	provider: "GOOGLE" | "OUTLOOK" | "IMAP",
): MailProvider {
	if (provider === "OUTLOOK") {
		return outlookProvider;
	}
	if (provider === "IMAP") {
		return imapProvider;
	}
	return gmailProvider;
}
