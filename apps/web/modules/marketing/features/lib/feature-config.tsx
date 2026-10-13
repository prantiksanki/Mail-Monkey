import {
	ArchiveIcon,
	BellRingIcon,
	BrainCircuitIcon,
	FilterIcon,
	FingerprintIcon,
	FolderCheckIcon,
	GaugeIcon,
	LayersIcon,
	MailCheckIcon,
	MailXIcon,
	PlugZapIcon,
	RadarIcon,
	ReceiptTextIcon,
	RefreshCwIcon,
	Repeat2Icon,
	ShieldCheckIcon,
	SplitIcon,
	TimerResetIcon,
	UserCogIcon,
	WandSparklesIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export interface FeatureBenefit {
	title: string;
	description: string;
}

export interface FeatureChecklistItem {
	icon: ReactNode;
	label: string;
}

export interface FeatureImage {
	src: string;
	alt: string;
}

export interface FeatureDefinition {
	slug: string;
	navLabel: string;
	metaTitle: string;
	metaDescription: string;
	eyebrow: string;
	title: ReactNode;
	subtitle: string;
	description: string;
	checklist: string[];
	heroImage: FeatureImage;
	bannerImage: FeatureImage;
	benefitsEyebrow: string;
	benefitsTitle: string;
	benefitsIntro: string;
	benefits: FeatureBenefit[];
	ctaTitle: ReactNode;
}

export const FEATURES: FeatureDefinition[] = [
	{
		slug: "every-integration",
		navLabel: "Every integration",
		metaTitle: "One Inbox, Every Integration",
		metaDescription:
			"Gmail, Outlook, Slack, Zoom, Telegram, WhatsApp, Google Meet, HubSpot, Notion, Teams and Zoho — all connected and in sync inside Mail Monkey.",
		eyebrow: "Integrations",
		title: (
			<>
				Every tool.
				<br />
				One place.
			</>
		),
		subtitle: "All connected, all in sync.",
		description:
			"Telegram, Google, Slack, Zoom, WhatsApp, Meet, HubSpot, Outlook, Teams — connect the tools you already use and let Mail Monkey bring every conversation into one place.",
		checklist: [
			"Connect any tool in a few clicks",
			"Every update syncs back in real time",
		],
		heroImage: {
			src: "https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=1200&h=1400&fit=crop",
			alt: "Desk setup with multiple apps and devices connected side by side",
		},
		bannerImage: {
			src: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=2000&h=900&fit=crop",
			alt: "Team collaborating across multiple connected tools and screens",
		},
		benefitsEyebrow: "Why connect everything",
		benefitsTitle: "Stop switching tabs to stay in the loop.",
		benefitsIntro:
			"Mail Monkey pulls every integration into one stream, so nothing important gets stuck in a tool you forgot to check.",
		benefits: [
			{
				title: "One place for every signal",
				description:
					"Email, chat, meetings and CRM updates all land in the same unified stream — no more app hopping.",
			},
			{
				title: "Real-time sync",
				description:
					"Changes in a connected tool reflect in Mail Monkey instantly, and vice versa where the integration allows it.",
			},
			{
				title: "Context stays attached",
				description:
					"Every item keeps its source, sender, and thread — so you always know exactly where it came from.",
			},
			{
				title: "Add tools as you grow",
				description:
					"New integrations connect the same way — one OAuth screen, no engineering required.",
			},
		],
		ctaTitle: (
			<>
				Ready to connect
				<br />
				every tool you use?
			</>
		),
	},
	{
		slug: "inbox-transformed",
		navLabel: "Inbox, transformed",
		metaTitle: "Inbox, Transformed",
		metaDescription:
			"From chaos to calm — Mail Monkey automatically unifies, labels, and archives your inbox so nothing important gets missed.",
		eyebrow: "The transformation",
		title: <>Inbox, transformed.</>,
		subtitle: "From chaos to calm — automatically.",
		description:
			"Newsletters, receipts, cold outreach, alerts, multiple accounts in separate tabs — Mail Monkey turns the noise into a quiet, intentional space in minutes.",
		checklist: [
			"Every account unified into one calm view",
			"AI rules archive, label, and file everything",
		],
		heroImage: {
			src: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&h=1400&fit=crop",
			alt: "Calm, minimal workspace with a laptop and soft natural light",
		},
		bannerImage: {
			src: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=2000&h=900&fit=crop",
			alt: "Person working calmly at a clean, organized desk",
		},
		benefitsEyebrow: "Before and after",
		benefitsTitle: "Hours of triage become seconds of review.",
		benefitsIntro:
			"The same inbox, minus the clutter. Here's what changes once Mail Monkey takes over the busywork.",
		benefits: [
			{
				title: "Fewer unread emails",
				description:
					"Rules clear the noise automatically, so what's left in your inbox actually needs your attention.",
			},
			{
				title: "No more tab-switching",
				description:
					"Every account you connect shows up in the same calm surface — no juggling browser tabs.",
			},
			{
				title: "Nothing falls through",
				description:
					"Auto-filed mail is still searchable and labeled, not lost — just out of your way until you need it.",
			},
			{
				title: "Set once, runs forever",
				description:
					"Rules keep working in the background, so the calm doesn't wear off after week one.",
			},
		],
		ctaTitle: (
			<>
				Ready to turn the
				<br />
				chaos into calm?
			</>
		),
	},
	{
		slug: "email-intelligence",
		navLabel: "Email intelligence",
		metaTitle: "Email Intelligence, Built In",
		metaDescription:
			"Mail Monkey reads your mail the way you do — understanding context, auto-labeling, and firing rules the moment mail arrives.",
		eyebrow: "Intelligence",
		title: (
			<>
				Email intelligence.
				<br />
				Built in.
			</>
		),
		subtitle: "Reads your mail the way you do.",
		description:
			"Not just keywords — Mail Monkey understands sender, subject, body, and your past behavior to apply the right rule, every time.",
		checklist: [
			"Rules fire the instant mail arrives",
			"Combine AI and static conditions in one rule",
		],
		heroImage: {
			src: "https://images.unsplash.com/photo-1555949963-aa79dcee981c?w=1200&h=1400&fit=crop",
			alt: "Abstract visualization of connected data and analytics",
		},
		bannerImage: {
			src: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=2000&h=900&fit=crop",
			alt: "Person analyzing data and making decisions at a desk",
		},
		benefitsEyebrow: "How it thinks",
		benefitsTitle: "The judgment of a great assistant, running nonstop.",
		benefitsIntro:
			"Mail Monkey doesn't just sort by sender — it understands context well enough to act the way you would.",
		benefits: [
			{
				title: "Understands context",
				description:
					"Sender, subject, body, and your past behavior all factor into which rule applies.",
			},
			{
				title: "Auto-labeling",
				description:
					"Incoming mail is categorized the moment it lands — no manual sorting, no missed threads.",
			},
			{
				title: "AND / OR conditions",
				description:
					"Combine static conditions with AI conditions in a single rule — precise or broad, your call.",
			},
			{
				title: "Auto-reply & forward",
				description:
					"Set rules to reply or forward automatically — ideal for routing support, leads, or team mail.",
			},
		],
		ctaTitle: (
			<>
				Ready for an inbox
				<br />
				that thinks with you?
			</>
		),
	},
	{
		slug: "smart-archiving",
		navLabel: "Smart archiving",
		metaTitle: "Smart Archiving That Misses Nothing",
		metaDescription:
			"Newsletters, receipts, shipping updates, and bank statements — all auto-filed by Mail Monkey the moment they arrive.",
		eyebrow: "Smart archiving",
		title: (
			<>
				Archives everything.
				<br />
				Misses nothing.
			</>
		),
		subtitle: "Auto-filed the moment it arrives.",
		description:
			"Newsletters, receipts, shipping updates, bank statements — Mail Monkey files it all away instantly, while keeping every item searchable and labeled.",
		checklist: [
			"Archives run the second mail lands",
			"Nothing is deleted — just filed and labeled",
		],
		heroImage: {
			src: "https://images.unsplash.com/photo-1568667256549-094345857637?w=1200&h=1400&fit=crop",
			alt: "Neatly organized file folders and storage boxes",
		},
		bannerImage: {
			src: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=2000&h=900&fit=crop",
			alt: "Organized shelves of labeled folders and archives",
		},
		benefitsEyebrow: "What gets filed",
		benefitsTitle: "The busywork disappears. The record doesn't.",
		benefitsIntro:
			"Archiving isn't hiding — it's filing. Everything stays searchable, labeled, and one click away.",
		benefits: [
			{
				title: "Newsletters, handled",
				description:
					"Subscriptions get archived automatically so they never pile up in your primary view.",
			},
			{
				title: "Receipts, labeled",
				description:
					"Purchase and payment emails are tagged and filed under Finance without you lifting a finger.",
			},
			{
				title: "Shipping updates, out of the way",
				description:
					"Delivery notifications archive themselves the moment they're no longer actionable.",
			},
			{
				title: "Cold outreach, filtered",
				description:
					"Unsolicited mail from unknown senders gets archived automatically, keeping your inbox intentional.",
			},
		],
		ctaTitle: (
			<>
				Ready to let your
				<br />
				inbox archive itself?
			</>
		),
	},
	{
		slug: "multi-account",
		navLabel: "Multi-account",
		metaTitle: "Every Account, One Place",
		metaDescription:
			"Gmail, Outlook, work, and side projects — all unified in a single view with per-account rules and real-time sync.",
		eyebrow: "Multi-account",
		title: (
			<>
				Every account.
				<br />
				One place.
			</>
		),
		subtitle: "No more juggling tabs.",
		description:
			"Gmail, Outlook, work, side projects — all unified in a single view, with separate rules per inbox but one calm surface to manage everything from.",
		checklist: [
			"Unified view across every connected account",
			"OAuth only — we never store your password",
		],
		heroImage: {
			src: "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1200&h=1400&fit=crop",
			alt: "Multiple devices — laptop, tablet, and phone — arranged together",
		},
		bannerImage: {
			src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=2000&h=900&fit=crop",
			alt: "Person working seamlessly across laptop and phone",
		},
		benefitsEyebrow: "Why unify your accounts",
		benefitsTitle: "One surface. Every inbox you own.",
		benefitsIntro:
			"Keep the boundaries between work and personal mail — just stop needing five tabs to check them.",
		benefits: [
			{
				title: "Unified inbox",
				description:
					"All your accounts in one stream. Switch views or see everything together.",
			},
			{
				title: "Per-account rules",
				description:
					"Set different rules for each account — work inbox stays different from personal.",
			},
			{
				title: "Syncs in real time",
				description:
					"Changes reflect instantly across all connected accounts, no manual refresh needed.",
			},
			{
				title: "Secure connections",
				description:
					"OAuth only. We never store your email password. Revoke access anytime.",
			},
		],
		ctaTitle: (
			<>
				Ready to unify
				<br />
				every inbox you own?
			</>
		),
	},
];

export function getFeatureBySlug(slug: string): FeatureDefinition | undefined {
	return FEATURES.find((feature) => feature.slug === slug);
}

export const FEATURE_ICONS_BY_SLUG: Record<string, ReactNode[]> = {
	"every-integration": [
		<LayersIcon key="layers" className="size-6" strokeWidth={1.75} />,
		<RefreshCwIcon key="sync" className="size-6" strokeWidth={1.75} />,
		<FingerprintIcon key="context" className="size-6" strokeWidth={1.75} />,
		<PlugZapIcon key="grow" className="size-6" strokeWidth={1.75} />,
	],
	"inbox-transformed": [
		<MailCheckIcon key="fewer" className="size-6" strokeWidth={1.75} />,
		<SplitIcon key="tabs" className="size-6" strokeWidth={1.75} />,
		<FolderCheckIcon key="filed" className="size-6" strokeWidth={1.75} />,
		<TimerResetIcon key="forever" className="size-6" strokeWidth={1.75} />,
	],
	"email-intelligence": [
		<BrainCircuitIcon key="brain" className="size-6" strokeWidth={1.75} />,
		<WandSparklesIcon key="wand" className="size-6" strokeWidth={1.75} />,
		<FilterIcon key="conditions" className="size-6" strokeWidth={1.75} />,
		<Repeat2Icon key="reply" className="size-6" strokeWidth={1.75} />,
	],
	"smart-archiving": [
		<BellRingIcon
			key="newsletters"
			className="size-6"
			strokeWidth={1.75}
		/>,
		<ReceiptTextIcon
			key="receipts"
			className="size-6"
			strokeWidth={1.75}
		/>,
		<ArchiveIcon key="shipping" className="size-6" strokeWidth={1.75} />,
		<MailXIcon key="cold" className="size-6" strokeWidth={1.75} />,
	],
	"multi-account": [
		<RadarIcon key="unified" className="size-6" strokeWidth={1.75} />,
		<UserCogIcon key="rules" className="size-6" strokeWidth={1.75} />,
		<GaugeIcon key="realtime" className="size-6" strokeWidth={1.75} />,
		<ShieldCheckIcon key="secure" className="size-6" strokeWidth={1.75} />,
	],
};
