import { getBaseUrl } from "@repo/utils";

export function JsonLd() {
	const baseUrl = getBaseUrl();

	const webSite = {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: "Popsuites",
		url: baseUrl,
	};

	const softwareApplication = {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: "Popsuites",
		applicationCategory: "BusinessApplication",
		operatingSystem: "Web, Gmail, Outlook",
		description:
			"Popsuites makes sure nothing in your inbox gets missed — intelligent routing and auto-labeling catch what other tools automate right past.",
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
				price: "5",
				priceCurrency: "USD",
			},
		],
	};

	return (
		<>
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
