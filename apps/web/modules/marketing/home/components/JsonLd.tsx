import { getBaseUrl } from "@repo/utils";

export function JsonLd() {
	const baseUrl = getBaseUrl();

	const organization = {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: "Zer0Email",
		url: baseUrl,
		logo: `${baseUrl}/images/hero-image.png`,
		description:
			"AI-powered email automation that keeps your inbox clean and surfaces what actually matters.",
		foundingDate: "2024",
		sameAs: ["https://x.com/Zer0Email"],
	};

	const webSite = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Zer0Email",
		url: baseUrl,
	};

	const softwareApplication = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "Zer0Email",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web, Gmail, Outlook",
		description:
			"Zer0Email uses intelligent routing and auto-labeling to keep your inbox clean and surface what actually matters.",
		url: baseUrl,
		offers: [
			{
				"@type": "Offer",
				name: "Free",
				price: "0",
				priceCurrency: "USD",
			},
			{
				"@type": "Offer",
				name: "Pro",
				price: "9",
				priceCurrency: "USD",
			},
		],
	};

	return (
		<>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(organization),
				}}
			/>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data
				dangerouslySetInnerHTML={{ __html: JSON.stringify(webSite) }}
			/>
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(softwareApplication),
				}}
			/>
		</>
	);
}
