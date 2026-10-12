export function getMailProviderInboxUrl(mailbox: {
	provider: string;
	email: string;
}): string {
	if (mailbox.provider === "GOOGLE") {
		return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(mailbox.email)}#inbox`;
	}
	if (mailbox.provider === "IMAP") {
		// No webmail URL exists for an arbitrary custom-domain host — fall back
		// to opening the user's own configured mail client.
		return `mailto:${mailbox.email}`;
	}
	return "https://outlook.office.com/mail/inbox";
}
