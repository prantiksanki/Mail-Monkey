import { Badge } from "@repo/ui/components/badge";
import {
	CheckCircle2Icon,
	ExternalLinkIcon,
	KeyRoundIcon,
	LockKeyholeIcon,
	ServerIcon,
	ShieldCheckIcon,
} from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

const SSL_LABS_URL =
	"https://www.ssllabs.com/ssltest/analyze.html?d=zer0email.com";
const MOZILLA_OBSERVATORY_URL =
	"https://observatory.mozilla.org/analyze/zer0email.com";

export const metadata: Metadata = {
	title: "Security | Zer0Email",
	description:
		"How Zer0Email protects your inbox: TLS 1.3 encryption, security headers, OAuth-only Gmail access, and third-party audits. Verify everything yourself.",
	alternates: { canonical: "https://zer0email.com/security" },
	openGraph: {
		title: "Security | Zer0Email",
		description:
			"How Zer0Email protects your inbox: TLS 1.3 encryption, security headers, OAuth-only Gmail access, and third-party audits.",
		url: "https://zer0email.com/security",
		siteName: "Zer0Email",
		type: "website",
	},
};

interface TrustSignal {
	label: string;
	grade: string;
	source: string;
	href: string;
	status: "verified" | "pending" | "in-progress";
	description: string;
}

const trustSignals: TrustSignal[] = [
	{
		label: "SSL / TLS",
		grade: "A+",
		source: "SSL Labs",
		href: SSL_LABS_URL,
		status: "verified",
		description:
			"TLS 1.3 with forward secrecy and post-quantum key exchange (X25519MLKEM768).",
	},
	{
		label: "Security Headers",
		grade: "A+",
		source: "Mozilla Observatory",
		href: MOZILLA_OBSERVATORY_URL,
		status: "verified",
		description:
			"HSTS preload, CSP, and frame protection headers enforced at the edge.",
	},
	{
		label: "CASA Tier 2",
		grade: "In progress",
		source: "Cloud Application Security Assessment",
		href: "https://appdefensealliance.dev/casa/tier-2",
		status: "in-progress",
		description:
			"Independent security audit required for Google API restricted scopes.",
	},
];

interface SecurityPractice {
	icon: ReactNode;
	title: string;
	description: string;
}

const practices: SecurityPractice[] = [
	{
		icon: <LockKeyholeIcon className="size-5" />,
		title: "Encryption in transit",
		description:
			"All traffic is served over TLS 1.3. HSTS is enforced with a 2-year max-age and includeSubDomains.",
	},
	{
		icon: <KeyRoundIcon className="size-5" />,
		title: "OAuth-only Gmail access",
		description:
			"We never see your Google password. Tokens are scoped, refreshable, and revocable from your Google account at any time.",
	},
	{
		icon: <ServerIcon className="size-5" />,
		title: "Minimal data retention",
		description:
			"Email content is processed in memory for AI tasks. We store metadata required for rules and digests, not full message bodies.",
	},
	{
		icon: <ShieldCheckIcon className="size-5" />,
		title: "No training on your data",
		description:
			"Your email is never used to train models — ours or any third-party provider's.",
	},
];

function StatusPill({ status }: { status: TrustSignal["status"] }) {
	const styles = {
		verified: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
		pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
		"in-progress": "border-sky-500/30 bg-sky-500/10 text-sky-400",
	} as const;

	const labels = {
		verified: "Verified",
		pending: "Pending scan",
		"in-progress": "In progress",
	} as const;

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-[11px] uppercase tracking-wide ${styles[status]}`}
		>
			{status === "verified" && (
				<CheckCircle2Icon className="size-3" aria-hidden="true" />
			)}
			{labels[status]}
		</span>
	);
}

function TrustBadge({ signal }: { signal: TrustSignal }) {
	return (
		<a
			href={signal.href}
			rel="noopener noreferrer"
			target="_blank"
			className="group flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-primary/40 hover:bg-white/[0.04]"
		>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-foreground/55 text-xs uppercase tracking-[0.14em]">
						{signal.label}
					</div>
					<div className="mt-1 font-bold text-3xl text-foreground">
						{signal.grade}
					</div>
				</div>
				<StatusPill status={signal.status} />
			</div>
			<p className="text-foreground/65 text-sm leading-relaxed">
				{signal.description}
			</p>
			<div className="mt-auto flex items-center gap-1.5 text-foreground/45 text-xs transition-colors group-hover:text-primary">
				Verified by {signal.source}
				<ExternalLinkIcon className="size-3" aria-hidden="true" />
			</div>
		</a>
	);
}

export default function SecurityPage() {
	return (
		<div className="container max-w-5xl pt-24 pb-20">
			<div className="mb-12 pt-8 text-center">
				<Badge className="mb-4 border-primary/30 bg-primary/10 text-primary">
					<ShieldCheckIcon
						className="mr-1.5 size-3.5"
						aria-hidden="true"
					/>
					Security
				</Badge>
				<h1 className="mb-3 font-bold text-5xl tracking-tight">
					Built on a quiet, encrypted foundation.
				</h1>
				<p className="mx-auto max-w-2xl text-balance text-foreground/55 text-lg">
					Zer0Email handles your inbox — that means we take
					encryption, transport security, and third-party audits
					seriously. Verify everything below for yourself.
				</p>
			</div>

			<section className="mb-16">
				<h2 className="mb-6 font-semibold text-2xl">Trust signals</h2>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{trustSignals.map((signal) => (
						<TrustBadge key={signal.label} signal={signal} />
					))}
				</div>
			</section>

			<section className="mb-16">
				<h2 className="mb-6 font-semibold text-2xl">
					How we protect your inbox
				</h2>
				<div className="grid gap-4 md:grid-cols-2">
					{practices.map((practice) => (
						<div
							key={practice.title}
							className="flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5"
						>
							<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
								{practice.icon}
							</div>
							<div>
								<h3 className="mb-1 font-semibold text-foreground">
									{practice.title}
								</h3>
								<p className="text-foreground/60 text-sm leading-relaxed">
									{practice.description}
								</p>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* Data flow */}
			<section className="mb-16">
				<h2 className="mb-4 font-semibold text-2xl">
					How your data flows
				</h2>
				<div className="space-y-4 text-foreground/70 text-sm leading-relaxed">
					<p>
						When you connect Gmail or Outlook, Zer0Email receives an
						OAuth access token scoped to the permissions you grant.
						We never see your password. The token is encrypted at
						rest using AES-256 and stored in our database. It is
						used exclusively to call the Gmail API or Microsoft
						Graph API on your behalf.
					</p>
					<p>
						When a new email arrives, your mail provider pushes a
						notification to our servers (Gmail via Pub/Sub, Outlook
						via Graph webhooks). We fetch the relevant email headers
						— sender, subject, date, and thread ID — and evaluate
						them against your active rules. If a rule condition
						requires reading the message body (for keyword matching
						or AI classification), we fetch the body in memory,
						evaluate the condition, and discard it. Message bodies
						are never written to disk or stored in our database.
					</p>
					<p>
						Rule actions (labeling, archiving, forwarding) are
						executed immediately via the same API. The entire
						process — from notification to action — completes in
						under two seconds for the vast majority of messages.
					</p>
					<p>
						We store the following in our database: your account
						email address, OAuth tokens (encrypted), rule
						definitions you create, and action logs (sender,
						subject, action taken, timestamp). We do not store
						message bodies, attachments, or full thread content.
					</p>
				</div>
			</section>

			{/* GDPR / DPA */}
			<section className="mb-16">
				<h2 className="mb-4 font-semibold text-2xl">
					GDPR &amp; data protection
				</h2>
				<div className="space-y-4 text-foreground/70 text-sm leading-relaxed">
					<p>
						Zer0Email is operated by PopPush AI. If you are located
						in the European Economic Area, the United Kingdom, or
						Switzerland, you have rights under the General Data
						Protection Regulation (GDPR) including the right to
						access, correct, export, or delete your personal data.
					</p>
					<p>
						Our lawful basis for processing your email account data
						is contractual necessity — you connect your mailbox
						specifically to receive the automation service. AI
						classification features rely on the same basis.
					</p>
					<p>
						We use the following sub-processors to operate the
						service: Microsoft Azure (infrastructure and database,
						hosted in the EU), Google Cloud (Pub/Sub notifications),
						and Zoho (email). Each sub-processor is bound by a Data
						Processing Agreement consistent with GDPR Article 28.
					</p>
					<p>
						To exercise your data rights or submit a deletion
						request, email{" "}
						<a
							href="mailto:founder@zer0email.com"
							className="text-foreground underline underline-offset-2"
						>
							founder@zer0email.com
						</a>
						. We will respond within 30 days.
					</p>
				</div>
			</section>

			{/* Breach policy */}
			<section className="mb-16">
				<h2 className="mb-4 font-semibold text-2xl">
					Breach notification policy
				</h2>
				<div className="space-y-4 text-foreground/70 text-sm leading-relaxed">
					<p>
						In the event of a confirmed security incident affecting
						personal data, we will notify affected users within 72
						hours of becoming aware of the breach. Notification will
						be sent to the email address associated with your
						account and will include: a description of the nature of
						the breach, the categories of data affected, the likely
						consequences, and the measures we have taken or propose
						to take.
					</p>
					<p>
						Where required by law, we will also notify the relevant
						supervisory authority within the same 72-hour window.
					</p>
				</div>
			</section>

			{/* Responsible disclosure */}
			<section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-8">
				<h2 className="mb-3 font-semibold text-xl">
					Responsible disclosure
				</h2>
				<p className="mb-4 text-foreground/65 text-sm leading-relaxed">
					If you believe you have found a security vulnerability in
					Zer0Email, we encourage responsible disclosure. Email us a
					description of the issue, reproduction steps, and any
					relevant evidence. We will acknowledge receipt within 48
					hours and aim to resolve confirmed issues within 14 days. We
					ask that you do not publicly disclose the issue until we
					have had a reasonable opportunity to address it.
				</p>
				<div className="flex flex-wrap gap-3">
					<a
						href="mailto:founder@zer0email.com"
						className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 font-medium text-primary text-sm transition-colors hover:bg-primary/20"
					>
						founder@zer0email.com
					</a>
					<a
						href="/.well-known/security.txt"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-medium text-foreground/60 text-sm transition-colors hover:text-foreground"
					>
						security.txt
					</a>
				</div>
			</section>
		</div>
	);
}
