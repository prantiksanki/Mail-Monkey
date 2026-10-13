import { FaqSection } from "@marketing/home/components/FaqSection";
import { FeatureCarousel } from "@marketing/home/components/FeatureCarousel";
import { FinalCta } from "@marketing/home/components/FinalCta";
import { Hero } from "@marketing/home/components/Hero";
import { JsonLd } from "@marketing/home/components/JsonLd";
import { SpeakYourMind } from "@marketing/home/components/SpeakYourMind";
import { StatsStrip } from "@marketing/home/components/StatsStrip";
import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { config as webConfig } from "@/config";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
	const baseUrl = getBaseUrl();
	const title = "AI Email Assistant for Gmail, Outlook & Zoho";
	const socialTitle =
		"AI Email Assistant for Gmail, Outlook & Zoho | Mail Monkey";
	const description =
		"Mail Monkey sorts and labels your email with AI so nothing important gets missed. Works inside Gmail, Outlook and Zoho Mail. Free plan to start.";

	return {
		title,
		description,
		alternates: { canonical: baseUrl, languages: { en: baseUrl } },
		openGraph: {
			title: socialTitle,
			description,
			url: baseUrl,
			siteName: "Mail Monkey",
			type: "website",
			images: [`${baseUrl}/opengraph-image`],
		},
		twitter: {
			card: "summary_large_image",
			title: socialTitle,
			description,
			images: [`${baseUrl}/opengraph-image`],
		},
	};
}

export default async function Home({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<>
			<JsonLd />
			<Hero />
			{webConfig.ui.showStats && <StatsStrip />}
			<SpeakYourMind />
			<FeatureCarousel />
			<FaqSection />
			<FinalCta />
		</>
	);
}
