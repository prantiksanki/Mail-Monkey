import { ArchiveDemo } from "@marketing/home/components/ArchiveDemo";
import { BeforeAfter } from "@marketing/home/components/BeforeAfter";
import { FaqSection } from "@marketing/home/components/FaqSection";
import { FinalCta } from "@marketing/home/components/FinalCta";
import { Hero } from "@marketing/home/components/Hero";
import { Intelligence } from "@marketing/home/components/Intelligence";
import { JsonLd } from "@marketing/home/components/JsonLd";
import { MultiAccount } from "@marketing/home/components/MultiAccount";
import { PricingSection } from "@marketing/home/components/PricingSection";
import { StatsStrip } from "@marketing/home/components/StatsStrip";
import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export const revalidate = 3600;

export function generateMetadata(): Metadata {
	const baseUrl = getBaseUrl();
	const title = "Zer0Email — AI Chief of Staff for Email";
	const description =
		"Zer0Email uses intelligent routing and auto-labeling to keep your inbox clean and surface what actually matters. Connect Gmail or Outlook in seconds.";

	return {
		title,
		description,
		alternates: { canonical: baseUrl, languages: { en: baseUrl } },
		openGraph: {
			title,
			description,
			url: baseUrl,
			siteName: "Zer0Email",
			type: "website",
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
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
			<StatsStrip />
			<BeforeAfter />
			<Intelligence />
			<ArchiveDemo />
			<MultiAccount />
			<PricingSection />
			<FaqSection />
			<FinalCta />
		</>
	);
}
