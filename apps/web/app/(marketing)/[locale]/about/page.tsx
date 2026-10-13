import { getBaseUrl } from "@repo/utils";
import { BreadcrumbJsonLd } from "@shared/components/BreadcrumbJsonLd";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export function generateMetadata(): Metadata {
	const url = `${getBaseUrl()}/about`;
	const title = "About";
	const socialTitle = "About — Mail Monkey";
	const description =
		"Mail Monkey is a college project built to make sure the brand deals, client requests, and investor replies in your inbox never get missed. Learn who we are, why we built this, and how we think about email.";

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title: socialTitle,
			description,
			url,
			siteName: "Mail Monkey",
			type: "website",
			images: ["/opengraph-image"],
		},
		twitter: {
			card: "summary_large_image",
			title: socialTitle,
			description,
			images: ["/opengraph-image"],
		},
	};
}

export default async function AboutPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	const baseUrl = getBaseUrl();

	return (
		<div className="container max-w-4xl px-6 pt-24 pb-20">
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", url: baseUrl },
					{ name: "About", url: `${baseUrl}/about` },
				]}
			/>
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
						<strong className="text-foreground">Mail Monkey</strong>{" "}
						is an AI-powered email management app built as a college
						major project. It connects to Gmail and Outlook via
						OAuth and automates inbox triage, labeling, archiving,
						and replies using AI-powered rules.
					</p>
					<p>
						Mail Monkey started with a simple frustration: the inbox
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
						So we built one. Mail Monkey connects to your Gmail or
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
							We are a small student team building Mail Monkey as
							our major project: an AI-native inbox assistant for
							people who spend too much time inside their email.
						</p>
						<p>
							We care about two things above everything else:
							speed (rules execute in milliseconds, not minutes)
							and privacy (email content is encrypted at rest and
							never used to train AI models).
						</p>
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
							href="mailto:support@mailmonkey.app"
							className="font-medium text-foreground underline underline-offset-2 hover:opacity-70"
						>
							support@mailmonkey.app
						</a>
						.
					</p>
				</section>
			</div>
		</div>
	);
}
