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
			</div>
		</div>
	);
}
