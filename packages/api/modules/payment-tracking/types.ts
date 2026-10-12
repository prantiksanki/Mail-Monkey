export interface PaymentCardListItem {
	id: string;
	mailboxId: string;
	provider: "GOOGLE" | "OUTLOOK" | "IMAP";
	mailboxEmail: string;
	emailId: string;
	threadId: string;
	subject: string;
	from: string;
	fromEmail: string;
	receivedAt: string;
	paymentType: string;
	merchant: string;
	amount: number | null;
	currency: string | null;
	dueDate: string | null;
	paymentStatus: string;
	confidence: number;
	kanbanStatus: "UPCOMING" | "DUE_SOON" | "OVERDUE" | "PAID";
	statusSource: "AUTOMATIC" | "MANUAL";
}

export interface PaymentCardAttachment {
	attachmentId: string;
	filename: string;
	mimeType: string;
	size: number;
}

export interface PaymentCardDetail extends PaymentCardListItem {
	to: string;
	bodyText: string;
	bodyHtml: string;
	attachments: PaymentCardAttachment[];
}
