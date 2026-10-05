import { FaqSection } from "@marketing/home/components/FaqSection";
import { FinalCta } from "@marketing/home/components/FinalCta";
import { PricingCompare } from "@marketing/home/components/PricingCompare";
import { PricingSection } from "@marketing/home/components/PricingSection";
import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export function generateMetadata(): Metadata {
	const url = `${getBaseUrl()}/pricing`;
	const title = "Pricing — Zer0Email";
	const description =
		"Simple, transparent pricing for AI-powered email automation. Start free, upgrade when you're ready. No hidden fees.";

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

export default async function PricingPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<>
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
