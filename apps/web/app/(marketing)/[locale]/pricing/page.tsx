import { FaqSection } from "@marketing/home/components/FaqSection";
import { FinalCta } from "@marketing/home/components/FinalCta";
import { PricingCompare } from "@marketing/home/components/PricingCompare";
import { PricingSection } from "@marketing/home/components/PricingSection";
import { getBaseUrl } from "@repo/utils";
import { BreadcrumbJsonLd } from "@shared/components/BreadcrumbJsonLd";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export function generateMetadata(): Metadata {
	const url = `${getBaseUrl()}/pricing`;
	const title = "Pricing";
	const socialTitle = "Pricing — MailMonkey";
	const description =
		"Simple, transparent pricing for AI-powered email automation. Start free, upgrade when you're ready. No hidden fees.";

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: {
			title: socialTitle,
			description,
			url,
			siteName: "MailMonkey",
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

export default async function PricingPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	const baseUrl = getBaseUrl();
	const webApplication = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		name: "MailMonkey",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web, Gmail, Outlook",
		url: `${baseUrl}/pricing`,
		offers: [
			{
				"@type": "Offer",
				name: "Free",
				price: "0",
				priceCurrency: "USD",
				url: `${baseUrl}/pricing`,
			},
			{
				"@type": "Offer",
				name: "Pro",
				price: "5",
				priceCurrency: "USD",
				url: `${baseUrl}/pricing`,
			},
		],
	};

	return (
		<>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(webApplication),
				}}
			/>
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", url: baseUrl },
					{ name: "Pricing", url: `${baseUrl}/pricing` },
				]}
			/>
			<div className="bg-black">
				<PricingSection />
				<div className="px-6 pb-24 sm:px-8 sm:pb-32">
					<div className="mx-auto max-w-5xl">
						<PricingCompare />
					</div>
				</div>
			</div>
			<FaqSection />
			<FinalCta />
		</>
	);
}
