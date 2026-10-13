import { FeatureBanner } from "@marketing/features/components/FeatureBanner";
import { FeatureBenefits } from "@marketing/features/components/FeatureBenefits";
import { FeatureFinalCta } from "@marketing/features/components/FeatureFinalCta";
import { FeatureHero } from "@marketing/features/components/FeatureHero";
import {
	FEATURES,
	getFeatureBySlug,
} from "@marketing/features/lib/feature-config";
import { getBaseUrl } from "@repo/utils";
import { BreadcrumbJsonLd } from "@shared/components/BreadcrumbJsonLd";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

export function generateStaticParams() {
	return FEATURES.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const feature = getFeatureBySlug(slug);
	if (!feature) {
		return {};
	}

	const url = `${getBaseUrl()}/features/${feature.slug}`;

	return {
		title: feature.metaTitle,
		description: feature.metaDescription,
		alternates: { canonical: url },
		openGraph: {
			title: feature.metaTitle,
			description: feature.metaDescription,
			url,
			siteName: "Mail Monkey",
			type: "website",
			images: ["/opengraph-image"],
		},
		twitter: {
			card: "summary_large_image",
			title: feature.metaTitle,
			description: feature.metaDescription,
			images: ["/opengraph-image"],
		},
	};
}

export default async function FeaturePage({
	params,
}: {
	params: Promise<{ locale: string; slug: string }>;
}) {
	const { locale, slug } = await params;
	setRequestLocale(locale);

	const feature = getFeatureBySlug(slug);
	if (!feature) {
		notFound();
	}

	const baseUrl = getBaseUrl();

	return (
		<>
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", url: baseUrl },
					{
						name: feature.navLabel,
						url: `${baseUrl}/features/${feature.slug}`,
					},
				]}
			/>
			<FeatureHero feature={feature} />
			<FeatureBanner feature={feature} />
			<FeatureBenefits feature={feature} />
			<FeatureFinalCta feature={feature} />
		</>
	);
}
