import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale } from "next-intl/server";

export function generateMetadata(): Metadata {
	const url = `${getBaseUrl()}/about`;
	const title = "About — Zer0Email";
	const description =
		"Zer0Email is built by PopPush AI to give every professional an AI chief of staff for their inbox. Learn who we are, why we built this, and how we think about email.";

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title,
			description,
			url,
			siteName: "Zer0Email",
			type: "website",
		},
		twitter: { card: "summary_large_image", title, description },
	};
}

export default async function AboutPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<div className="container max-w-4xl px-6 pt-24 pb-20">
			<div className="mx-auto max-w-3xl">
				{/* Header */}
				<div className="mb-16 pt-8">
					<span className="mb-4 inline-block rounded-full bg-foreground px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-background">
						About
					</span>
					<h1 className="mt-4 font-bold text-5xl leading-tight tracking-tight">
						We built the inbox tool
						<br />
						we couldn't find.
					</h1>
				</div>

				{/* Entity bio */}
				<section className="mb-12 space-y-5 text-lg leading-relaxed text-foreground/80">
					<p>
						<strong className="text-foreground">Zer0Email</strong>{" "}
						is an AI-powered email management platform built by{" "}
						<strong className="text-foreground">
							PopPush AI Private Limited
						</strong>
						, founded in{" "}
						<strong className="text-foreground">2026</strong> and
						headquartered in{" "}
						<strong className="text-foreground">
							Bengaluru, Karnataka, India
						</strong>
						. It connects to Gmail and Outlook via OAuth and
						automates inbox triage, labeling, archiving, and replies
						using AI-powered rules.
					</p>
					<p>
						Zer0Email started with a simple frustration: the inbox
						had become a second job. Newsletters, marketing blasts,
						thread replies, calendar invites, and the occasional
						message that actually mattered — all arriving in the
						same undifferentiated stream, demanding the same
						attention.
					</p>
					<p>
						Most "email tools" made the problem worse. Folders,
						filters, and labels shifted the burden from reading to
						organizing. You were still doing all the work — just
						slightly differently. What we wanted was an assistant
						that understood context, learned what mattered to us,
						and acted on our behalf. Not another toggle.
					</p>
					<p>
						So we built one. Zer0Email connects to your Gmail or
						Outlook account via OAuth, processes incoming mail
						against rules you define (in plain English or with our
						rule editor), and takes action — labeling, archiving,
						forwarding, or replying — the moment a matching email
						arrives. No batch processing. No delay. Your inbox stays
						clean continuously.
					</p>
				</section>

				{/* Divider */}
				<hr className="my-12 border-border" />

				{/* Who we are */}
				<section className="mb-12">
					<h2 className="mb-6 font-bold text-3xl">Who we are</h2>
					<div className="space-y-5 text-lg leading-relaxed text-foreground/80">
						<p>
							We are{" "}
							<strong className="text-foreground">
								PopPush AI
							</strong>
							, a small team building AI-native productivity tools
							for professionals who spend too much time inside
							their inbox. We are backed by{" "}
							<strong className="text-foreground">
								Google for Startups
							</strong>{" "}
							and the{" "}
							<strong className="text-foreground">
								NVIDIA Inception Program
							</strong>
							.
						</p>
						<p>
							We care about three things above everything else:
							speed (rules execute in milliseconds, not minutes),
							privacy (email content is processed in memory and
							never stored on our servers), and trust (we are
							working through CASA Tier 2 certification for our
							Google API scopes so you can verify our security
							posture independently).
						</p>
					</div>
				</section>

				{/* Backed by */}
				<section className="mb-12 rounded-2xl border border-border bg-card p-8">
					<h2 className="mb-6 font-semibold text-xl">Backed by</h2>
					<div className="flex flex-wrap items-center gap-8">
						<div className="flex items-center gap-3">
							<svg
								width="24"
								height="24"
								viewBox="0 0 48 48"
								role="img"
								aria-label="Google"
							>
								<path
									d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
									fill="#FFC107"
								/>
								<path
									d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
									fill="#FF3D00"
								/>
								<path
									d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.312 0-9.623-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
									fill="#4CAF50"
								/>
								<path
									d="M43.611 20.083H42V20H24v8h11.303a11.987 11.987 0 01-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
									fill="#1976D2"
								/>
							</svg>
							<div>
								<div className="font-semibold text-foreground">
									Google for Startups
								</div>
								<div className="text-foreground/50 text-sm">
									Cloud &amp; AI Program
								</div>
							</div>
						</div>
						<div className="h-10 w-px bg-border" />
						<div className="flex items-center gap-3">
							<div className="rounded bg-foreground px-2 py-1">
								<Image
									src="/images/nvidia-logo.jpg"
									alt="NVIDIA"
									width={56}
									height={20}
									className="object-contain"
								/>
							</div>
							<div>
								<div className="font-semibold text-foreground">
									NVIDIA Inception
								</div>
								<div className="text-foreground/50 text-sm">
									AI Startup Program
								</div>
							</div>
						</div>
					</div>
				</section>

				{/* Contact */}
				<section>
					<h2 className="mb-4 font-bold text-3xl">Get in touch</h2>
					<p className="mb-4 text-lg leading-relaxed text-foreground/80">
						We read every message. If you have a question, a feature
						idea, or just want to talk about email automation, reach
						us at{" "}
						<a
							href="mailto:founder@zer0email.com"
							className="font-medium text-foreground underline underline-offset-2 hover:opacity-70"
						>
							founder@zer0email.com
						</a>
						.
					</p>
				</section>
			</div>
		</div>
	);
}
