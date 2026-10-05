import type { CreateRuleInput } from "./types";

export interface RuleTemplate {
	id: string;
	name: string;
	description: string;
	category:
		| "Inbox Zero"
		| "Stay Informed"
		| "Finance"
		| "Meetings"
		| "Shopping"
		| "Security"
		| "Social";
	icon: string;
	rule: CreateRuleInput & { enabled: true };
	starter?: boolean;
	popular?: boolean;
}

export const RULE_TEMPLATE_CATEGORIES = [
	"All",
	"Inbox Zero",
	"Stay Informed",
	"Finance",
	"Meetings",
	"Shopping",
	"Security",
	"Social",
] as const;

export type RuleTemplateCategory = (typeof RULE_TEMPLATE_CATEGORIES)[number];

export const RULE_TEMPLATES: RuleTemplate[] = [
	// ── Inbox Zero ───────────────────────────────────────────────────────────────
	{
		id: "newsletters",
		name: "Archive Newsletters",
		description:
			"Automatically archives marketing emails, newsletters, and subscription content to keep your inbox clean.",
		category: "Inbox Zero",
		icon: "Newspaper",
		rule: {
			name: "Archive Newsletters",
			condition: {
				aiInstructions:
					"This is a newsletter, marketing email, or subscription content from a brand, company, or publication. It is not a personal email or a transactional email like an order confirmation.",
			},
			actions: [
				{ type: "ARCHIVE" },
				{ type: "LABEL", fields: { label: "Newsletter" } },
			],
			enabled: true,
		},
		starter: true,
		popular: true,
	},
	{
		id: "promotions",
		name: "Archive Promotional Emails",
		description:
			"Clears out discount offers, sale announcements, and marketing campaigns from brands and retailers.",
		category: "Inbox Zero",
		icon: "Tag",
		rule: {
			name: "Archive Promotional Emails",
			condition: {
				aiInstructions:
					"This is a promotional email, discount offer, sale announcement, or marketing campaign from a brand, retailer, or e-commerce store.",
			},
			actions: [
				{ type: "ARCHIVE" },
				{ type: "LABEL", fields: { label: "Promotions" } },
			],
			enabled: true,
		},
		popular: true,
		starter: true,
	},
	{
		id: "bulk-read",
		name: "Mark Bulk Emails as Read",
		description:
			"Automatically marks mass-sent and automated emails as read so they don't pad your unread count.",
		category: "Inbox Zero",
		icon: "MailOpen",
		rule: {
			name: "Mark Bulk Emails as Read",
			condition: {
				aiInstructions:
					"This email was sent in bulk to many recipients, is a mass email, automated system notification, or sent from a no-reply address. It is not a personal one-to-one email.",
			},
			actions: [{ type: "MARK_READ" }],
			enabled: true,
		},
	},

	// ── Stay Informed ─────────────────────────────────────────────────────────────
	{
		id: "vip-flag",
		name: "Flag Emails from VIPs",
		description:
			"Labels emails from executives, key clients, and important contacts so you never miss what matters.",
		category: "Stay Informed",
		icon: "Star",
		rule: {
			name: "Flag Emails from VIPs",
			condition: {
				aiInstructions:
					"This email is from a CEO, executive, board member, investor, or important client that requires my prompt attention and should not be missed.",
			},
			actions: [{ type: "LABEL", fields: { label: "VIP" } }],
			enabled: true,
		},
		popular: true,
	},
	{
		id: "urgent-alerts",
		name: "Label Urgent Emails",
		description:
			"Labels emails with urgent language, deadlines, or ASAP requests that need immediate action.",
		category: "Stay Informed",
		icon: "BellRing",
		rule: {
			name: "Label Urgent Emails",
			condition: {
				aiInstructions:
					"This email contains urgent language such as 'urgent', 'ASAP', 'immediately', 'deadline today', or clearly requires my immediate attention or decision.",
			},
			actions: [{ type: "LABEL", fields: { label: "Urgent" } }],
			enabled: true,
		},
	},
	{
		id: "awaiting-reply",
		name: "Label Emails Awaiting Reply",
		description:
			"Labels emails where someone is waiting for your response so nothing falls through the cracks.",
		category: "Stay Informed",
		icon: "Reply",
		rule: {
			name: "Label Emails Awaiting Reply",
			condition: {
				aiInstructions:
					"This email is directly asking me a question, requesting my input, or waiting for my reply or response from me specifically.",
			},
			actions: [{ type: "LABEL", fields: { label: "Needs Reply" } }],
			enabled: true,
		},
	},
	{
		id: "key-clients",
		name: "Label Emails from Clients",
		description:
			"Labels emails from clients and business partners to keep client communication front and center.",
		category: "Stay Informed",
		icon: "Users",
		rule: {
			name: "Label Emails from Clients",
			condition: {
				aiInstructions:
					"This email is from a business client, customer, or external business partner asking about a project, contract, proposal, or business matter.",
			},
			actions: [{ type: "LABEL", fields: { label: "Clients" } }],
			enabled: true,
		},
	},

	// ── Finance ───────────────────────────────────────────────────────────────────
	{
		id: "receipts",
		name: "Label Receipts & Invoices",
		description:
			"Labels receipts, invoices, and payment confirmations for products or services.",
		category: "Finance",
		icon: "Receipt",
		rule: {
			name: "Label Receipts & Invoices",
			condition: {
				aiInstructions:
					"This is a receipt, invoice, or payment confirmation for a product or service that I have purchased or subscribed to.",
			},
			actions: [{ type: "LABEL", fields: { label: "Finance" } }],
			enabled: true,
		},
		starter: true,
		popular: true,
	},
	{
		id: "banking",
		name: "Label Bank Statements",
		description:
			"Labels bank statements, account summaries, and financial statements from banks or financial institutions.",
		category: "Finance",
		icon: "Landmark",
		rule: {
			name: "Label Bank Statements",
			condition: {
				aiInstructions:
					"This is a bank statement, account summary, or financial statement from a bank or financial institution.",
			},
			actions: [{ type: "LABEL", fields: { label: "Banking" } }],
			enabled: true,
		},
	},
	{
		id: "bills",
		name: "Label Bills & Payment Reminders",
		description:
			"Labels bills, payment due reminders, and payment requests for utilities, subscriptions, or services.",
		category: "Finance",
		icon: "CreditCard",
		rule: {
			name: "Label Bills & Payment Reminders",
			condition: {
				aiInstructions:
					"This is a bill, payment due reminder, or payment request for utilities, subscriptions, or services that requires my action.",
			},
			actions: [{ type: "LABEL", fields: { label: "Bills" } }],
			enabled: true,
		},
	},
	{
		id: "subscriptions",
		name: "Label Subscription Renewals",
		description:
			"Labels subscription renewal notices, auto-billing alerts, and plan upgrade reminders.",
		category: "Finance",
		icon: "RefreshCw",
		rule: {
			name: "Label Subscription Renewals",
			condition: {
				aiInstructions:
					"This is a subscription renewal notice, auto-renewal confirmation, or billing reminder for a recurring subscription or service plan.",
			},
			actions: [{ type: "LABEL", fields: { label: "Subscriptions" } }],
			enabled: true,
		},
	},
	{
		id: "tax-documents",
		name: "Label Tax Documents",
		description:
			"Labels tax forms, year-end statements, and tax-related documents from financial institutions.",
		category: "Finance",
		icon: "FileText",
		rule: {
			name: "Label Tax Documents",
			condition: {
				aiInstructions:
					"This is a tax document, W-2, 1099, tax form, year-end statement, or tax-related notice from a financial institution or government agency.",
			},
			actions: [{ type: "LABEL", fields: { label: "Tax Documents" } }],
			enabled: true,
		},
	},

	// ── Meetings ──────────────────────────────────────────────────────────────────
	{
		id: "meetings",
		name: "Label Meeting Invitations",
		description:
			"Labels calendar invites, meeting requests, and scheduling emails so you can find them quickly.",
		category: "Meetings",
		icon: "Calendar",
		rule: {
			name: "Label Meeting Invitations",
			condition: {
				aiInstructions:
					"This is a meeting invitation, calendar invite, or scheduling request asking me to join a call, meeting, or event.",
			},
			actions: [{ type: "LABEL", fields: { label: "Meetings" } }],
			enabled: true,
		},
	},
	{
		id: "calendar-updates",
		name: "Label Calendar Updates",
		description:
			"Labels reschedules, cancellations, and changes to events already on your calendar.",
		category: "Meetings",
		icon: "CalendarClock",
		rule: {
			name: "Label Calendar Updates",
			condition: {
				aiInstructions:
					"This is a calendar event update, meeting reschedule, cancellation notice, or change to an existing event or meeting.",
			},
			actions: [{ type: "LABEL", fields: { label: "Calendar" } }],
			enabled: true,
		},
	},
	{
		id: "action-items",
		name: "Label Action Items from Meetings",
		description:
			"Captures follow-up tasks and to-dos that come out of meetings, calls, and project discussions.",
		category: "Meetings",
		icon: "ListChecks",
		rule: {
			name: "Label Action Items from Meetings",
			condition: {
				aiInstructions:
					"This email contains action items, follow-up tasks, or to-dos assigned to me from a meeting, call, or project discussion.",
			},
			actions: [{ type: "LABEL", fields: { label: "Action Items" } }],
			enabled: true,
		},
	},

	// ── Shopping ──────────────────────────────────────────────────────────────────
	{
		id: "orders",
		name: "Label Order Confirmations",
		description:
			"Labels order confirmations and purchase receipts from online stores for easy tracking.",
		category: "Shopping",
		icon: "ShoppingCart",
		rule: {
			name: "Label Order Confirmations",
			condition: {
				aiInstructions:
					"This is an order confirmation, purchase receipt, or order acknowledgment from an online store or e-commerce platform.",
			},
			actions: [{ type: "LABEL", fields: { label: "Orders" } }],
			enabled: true,
		},
		popular: true,
		starter: true,
	},
	{
		id: "shipping",
		name: "Label Shipping Updates",
		description:
			"Labels shipping notifications, delivery updates, and package tracking emails.",
		category: "Shopping",
		icon: "Package",
		rule: {
			name: "Label Shipping Updates",
			condition: {
				aiInstructions:
					"This is a shipping notification, delivery update, tracking information, or package status update from a courier or retailer.",
			},
			actions: [{ type: "LABEL", fields: { label: "Shipping" } }],
			enabled: true,
		},
	},
	{
		id: "delivery",
		name: "Label Delivery Notifications",
		description:
			"Labels out-for-delivery alerts and delivery confirmation emails from couriers.",
		category: "Shopping",
		icon: "Truck",
		rule: {
			name: "Label Delivery Notifications",
			condition: {
				aiInstructions:
					"This is an out-for-delivery notification, delivery attempt notice, or successful delivery confirmation from a courier or delivery service.",
			},
			actions: [{ type: "LABEL", fields: { label: "Deliveries" } }],
			enabled: true,
		},
	},
	{
		id: "returns",
		name: "Label Return Confirmations",
		description:
			"Labels return request confirmations, refund notices, and exchange confirmations from retailers.",
		category: "Shopping",
		icon: "RotateCcw",
		rule: {
			name: "Label Return Confirmations",
			condition: {
				aiInstructions:
					"This is a return request confirmation, refund notice, exchange confirmation, or return authorization from a retailer.",
			},
			actions: [{ type: "LABEL", fields: { label: "Returns" } }],
			enabled: true,
		},
	},

	// ── Security ──────────────────────────────────────────────────────────────────
	{
		id: "security",
		name: "Label Security Alerts",
		description:
			"Labels security alerts, password resets, login notifications, and account security warnings.",
		category: "Security",
		icon: "ShieldAlert",
		rule: {
			name: "Label Security Alerts",
			condition: {
				aiInstructions:
					"This is a security alert, password reset request, login notification, or account security warning from a service or application.",
			},
			actions: [{ type: "LABEL", fields: { label: "Security" } }],
			enabled: true,
		},
	},
	{
		id: "password-reset",
		name: "Label Password Reset Emails",
		description:
			"Labels password reset requests and account recovery emails for quick reference.",
		category: "Security",
		icon: "KeyRound",
		rule: {
			name: "Label Password Reset Emails",
			condition: {
				aiInstructions:
					"This is a password reset request, account recovery email, or forgot password confirmation from any service or application.",
			},
			actions: [{ type: "LABEL", fields: { label: "Password Resets" } }],
			enabled: true,
		},
	},
	{
		id: "2fa-codes",
		name: "Label 2FA & Verification Codes",
		description:
			"Labels two-factor authentication codes and email verification requests.",
		category: "Security",
		icon: "ShieldCheck",
		rule: {
			name: "Label 2FA & Verification Codes",
			condition: {
				aiInstructions:
					"This email contains a two-factor authentication code, one-time password (OTP), email verification link, or login confirmation code.",
			},
			actions: [
				{ type: "LABEL", fields: { label: "2FA Codes" } },
				{ type: "MARK_READ" },
			],
			enabled: true,
		},
	},

	// ── Social ────────────────────────────────────────────────────────────────────
	{
		id: "social",
		name: "Archive Social Notifications",
		description:
			"Automatically archives social media notifications from platforms like Twitter, Facebook, Instagram, and LinkedIn.",
		category: "Social",
		icon: "Users",
		rule: {
			name: "Archive Social Notifications",
			condition: {
				aiInstructions:
					"This is a social media notification from platforms like Twitter, Facebook, Instagram, LinkedIn, TikTok, or similar social networks.",
			},
			actions: [{ type: "ARCHIVE" }],
			enabled: true,
		},
		starter: true,
		popular: true,
	},
	{
		id: "linkedin",
		name: "Archive LinkedIn Notifications",
		description:
			"Clears LinkedIn connection requests, job alerts, and social activity emails from your inbox.",
		category: "Social",
		icon: "Linkedin",
		rule: {
			name: "Archive LinkedIn Notifications",
			condition: {
				aiInstructions:
					"This is a notification, alert, or digest email from LinkedIn, including connection requests, job alerts, profile views, or engagement notifications.",
			},
			actions: [{ type: "ARCHIVE" }],
			enabled: true,
		},
	},
	{
		id: "twitter",
		name: "Archive Twitter / X Notifications",
		description:
			"Clears Twitter and X notification emails so they don't fill your inbox.",
		category: "Social",
		icon: "Twitter",
		rule: {
			name: "Archive Twitter / X Notifications",
			condition: {
				aiInstructions:
					"This is a notification, digest, or alert email from Twitter or X, including mentions, replies, new followers, or trending topics.",
			},
			actions: [{ type: "ARCHIVE" }],
			enabled: true,
		},
	},
];

export const STARTER_RULE_TEMPLATES: RuleTemplate[] = RULE_TEMPLATES.filter(
	(t) => t.starter,
);
