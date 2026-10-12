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
		| "Social"
		| "Community";
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
	"Community",
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
	{
		id: "platform-notification-noise",
		name: "Archive Platform Notification Noise",
		description:
			"Archives routine, non-actionable platform notifications like new subscriber alerts, comment notifications, and algorithm updates so they don't compete with real opportunities for attention.",
		category: "Inbox Zero",
		icon: "BellOff",
		rule: {
			name: "Archive Platform Notification Noise",
			condition: {
				aiInstructions:
					"This is a routine, automated notification from a content platform such as YouTube, Instagram, or TikTok about a new comment, new subscriber, new follower, or a liked post. It is not a direct message, and it is not a comment or interaction the platform itself has flagged as high-engagement or from a VIP.",
			},
			actions: [{ type: "ARCHIVE" }],
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
					"This email is from a real, named individual who is a CEO, executive, board member, investor, or a known important client personally emailing me about a business matter. It is not an automated system notification, no-reply address, billing/payment alert, security alert, newsletter, or any email sent by a platform rather than a person, even if that email uses urgent language like 'action needed' or 'urgent'.",
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
					"This email contains urgent language such as 'urgent', 'ASAP', 'immediately', 'deadline today', or clearly requires my immediate attention or decision. It is not an automated security alert, sign-in notification, account-access confirmation, password reset, payment retry, or account-deletion/verification warning from a no-reply, notifications, or accounts sender, even if it mentions a deadline or says action is needed.",
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
	{
		id: "brand-deals",
		name: "Label Brand Deal & Sponsorship Emails",
		description:
			"Labels sponsorship inquiries, brand deal offers, and partnership proposals from companies and agencies so they surface above routine notifications.",
		category: "Stay Informed",
		icon: "Handshake",
		rule: {
			name: "Label Brand Deal & Sponsorship Emails",
			condition: {
				aiInstructions:
					"This email is a sponsorship inquiry, brand deal offer, paid partnership proposal, collaboration campaign, or rate card / media kit request from a company, brand, or marketing agency wanting to work with me. It is not a bulk marketing blast, an automated newsletter template, or an email with an unsubscribe footer and no direct personal ask.",
			},
			actions: [{ type: "LABEL", fields: { label: "Brand Deals" } }],
			enabled: true,
		},
	},
	{
		id: "investor-funding",
		name: "Label Investor & Funding Emails",
		description:
			"Labels investor replies, funding updates, and pitch responses so a critical fundraising conversation never gets lost in the noise.",
		category: "Stay Informed",
		icon: "Briefcase",
		rule: {
			name: "Label Investor & Funding Emails",
			condition: {
				aiInstructions:
					"This email is from a venture capital firm, angel investor, or startup accelerator/fund and is about a term sheet, cap table, pitch deck, funding round, due diligence, letter of intent, investment, or a follow-up call related to fundraising. It is not an investor-relations marketing blast or a newsletter-style fund update.",
			},
			actions: [{ type: "LABEL", fields: { label: "Investors" } }],
			enabled: true,
		},
	},
	{
		id: "press-media",
		name: "Label Press & Media Inquiries",
		description:
			"Labels interview requests, press inquiries, and media coverage opportunities from journalists and publications.",
		category: "Stay Informed",
		icon: "Newspaper",
		rule: {
			name: "Label Press & Media Inquiries",
			condition: {
				aiInstructions:
					"This email is a press inquiry, interview request, feature article request, or a request for a quote for a story, sent by a journalist, news outlet, or publication. It is not a mass PR agency pitch with no direct, personal ask.",
			},
			actions: [{ type: "LABEL", fields: { label: "Press & Media" } }],
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
	{
		id: "platform-payouts",
		name: "Label Platform Payout & Earnings Notifications",
		description:
			"Labels payout confirmations and earnings statements from creator monetization platforms, so income tracking stays separate from general finance mail.",
		category: "Finance",
		icon: "DollarSign",
		rule: {
			name: "Label Platform Payout & Earnings Notifications",
			condition: {
				aiInstructions:
					"This email is a payout confirmation, earnings summary, revenue report, monthly payment notice, or creator fund statement from a creator monetization platform such as YouTube/AdSense, Patreon, Stripe, TikTok, Gumroad, or Substack. It is not a generic Stripe receipt for an unrelated SaaS subscription charge.",
			},
			actions: [{ type: "LABEL", fields: { label: "Payouts" } }],
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

	// ── Community ─────────────────────────────────────────────────────────────────
	{
		id: "collab-requests",
		name: "Label Collaboration & Guest Requests",
		description:
			"Labels podcast guest invites, collab requests, and joint content proposals from other creators.",
		category: "Community",
		icon: "Mic",
		rule: {
			name: "Label Collaboration & Guest Requests",
			condition: {
				aiInstructions:
					"This email is a podcast guest invite, collaboration request, feature request, joint video proposal, or other request from a fellow creator to collaborate on content together. It is not an automated digest or notification from a 'creator community' platform.",
			},
			actions: [{ type: "LABEL", fields: { label: "Collabs" } }],
			enabled: true,
		},
	},
];

export const STARTER_RULE_TEMPLATES: RuleTemplate[] = RULE_TEMPLATES.filter(
	(t) => t.starter,
);

/**
 * Category → color, kept in sync with the `bg-*-500` dot classes used by the
 * Rules "Discover" page (CATEGORY_CONFIG in RulesLibrary.tsx). Uses Tailwind v4
 * palette CSS variables so consumers render the exact same shade as the tags.
 */
export const CATEGORY_COLORS: Record<RuleTemplate["category"], string> = {
	"Inbox Zero": "var(--color-emerald-500)",
	"Stay Informed": "var(--color-amber-500)",
	Finance: "var(--color-blue-500)",
	Meetings: "var(--color-purple-500)",
	Shopping: "var(--color-orange-500)",
	Security: "var(--color-red-500)",
	Social: "var(--color-pink-500)",
	Community: "var(--color-cyan-500)",
};

const TEMPLATE_CATEGORY_BY_NAME = new Map(
	RULE_TEMPLATES.map((t) => [t.rule.name.toLowerCase(), t.category]),
);

/**
 * Resolve the category of a rule created from a template by matching its name.
 * Returns undefined for custom rules that don't originate from a template.
 */
export function categoryForRuleName(
	name: string,
): RuleTemplate["category"] | undefined {
	return TEMPLATE_CATEGORY_BY_NAME.get(name.trim().toLowerCase());
}

/**
 * Map from the label name a template's LABEL action produces → its category.
 * Lets us color a Gmail label (created by name) to match the rule's category.
 */
const TEMPLATE_CATEGORY_BY_LABEL = new Map<string, RuleTemplate["category"]>();
for (const t of RULE_TEMPLATES) {
	for (const action of t.rule.actions) {
		if (action.type === "LABEL" && action.fields?.label) {
			const key = action.fields.label.trim().toLowerCase();
			if (!TEMPLATE_CATEGORY_BY_LABEL.has(key)) {
				TEMPLATE_CATEGORY_BY_LABEL.set(key, t.category);
			}
		}
	}
}

/**
 * Resolve the category for a label name produced by a template's LABEL action.
 * Returns undefined for custom labels that don't originate from a template.
 */
export function categoryForLabelName(
	label: string,
): RuleTemplate["category"] | undefined {
	return TEMPLATE_CATEGORY_BY_LABEL.get(label.trim().toLowerCase());
}

/**
 * Gmail label color for each category, using values from Gmail's fixed allowed
 * label-color palette (arbitrary hex is rejected by the API). Chosen to visually
 * match the app's category dot colors (CATEGORY_COLORS / the Rules-page tags):
 *   Inbox Zero → green, Stay Informed → amber, Finance → blue, Meetings → purple,
 *   Shopping → orange, Security → red, Social → pink, Community → cyan.
 * `textColor` is Gmail's standard high-contrast pairing for each background.
 */
// Category → colour, using ONLY verified Gmail-palette background/text pairings
// from LABEL_COLORS (label-colors.ts). Gmail rejects any backgroundColor/textColor
// pair that isn't an exact palette entry, so these must stay in sync with that
// list. Hues are chosen to match the Rules-page category tags; each background is
// distinct so categories stay visually separable in the sidebar.
export const CATEGORY_GMAIL_COLORS: Record<
	RuleTemplate["category"],
	{ backgroundColor: string; textColor: string }
> = {
	"Inbox Zero": { backgroundColor: "#16a766", textColor: "#ffffff" }, // green
	"Stay Informed": { backgroundColor: "#ffad47", textColor: "#ffffff" }, // orange
	Finance: { backgroundColor: "#4a86e8", textColor: "#ffffff" }, // blue
	Meetings: { backgroundColor: "#a479e2", textColor: "#ffffff" }, // purple
	Shopping: { backgroundColor: "#2da2bb", textColor: "#ffffff" }, // teal
	Security: { backgroundColor: "#fb4c2f", textColor: "#ffffff" }, // red
	Social: { backgroundColor: "#f691b3", textColor: "#000000" }, // pink
	Community: { backgroundColor: "#b99aff", textColor: "#000000" }, // lavender
};
