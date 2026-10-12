import { ZoomIntegrationBenefits } from "@marketing/integrations/components/ZoomIntegrationBenefits";
import { ZoomIntegrationDemo } from "@marketing/integrations/components/ZoomIntegrationDemo";
import { ZoomIntegrationFinalCta } from "@marketing/integrations/components/ZoomIntegrationFinalCta";
import { ZoomIntegrationFlow } from "@marketing/integrations/components/ZoomIntegrationFlow";
import { ZoomIntegrationHero } from "@marketing/integrations/components/ZoomIntegrationHero";
import { ZoomIntegrationResult } from "@marketing/integrations/components/ZoomIntegrationResult";
import { getBaseUrl } from "@repo/utils";
import { BreadcrumbJsonLd } from "@shared/components/BreadcrumbJsonLd";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export function generateMetadata(): Metadata {
	const url = `${getBaseUrl()}/integrations/zoom`;
	const title = "Zoom Integration";
	const socialTitle = "Zoom Integration — MailMonkey";
	const description =
		"Connect Zoom to MailMonkey and get a meeting link created automatically for every booking — no copy-pasting, no manual setup, no missed invites.";

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

export default async function ZoomIntegrationPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	const baseUrl = getBaseUrl();

	return (
		<>
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", url: baseUrl },
					{
						name: "Zoom Integration",
						url: `${baseUrl}/integrations/zoom`,
					},
				]}
			/>
			<ZoomIntegrationHero />
			<ZoomIntegrationBenefits />
			<ZoomIntegrationFlow />
			<ZoomIntegrationDemo />
			<ZoomIntegrationResult />
			<ZoomIntegrationFinalCta />
		</>
	);
}
