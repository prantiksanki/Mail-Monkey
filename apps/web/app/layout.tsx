import { cn } from "@repo/ui";
import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import Script from "next/script";
import type { PropsWithChildren } from "react";
import "./globals.css";
import { config } from "@/config";

const enzuzoCookiebarId = process.env.NEXT_PUBLIC_ENZUZO_COOKIEBAR_ID;

// Fonts are self-hosted from `./fonts` (see next/font/local) so dev/build never
// depends on reaching fonts.googleapis.com at compile time. JetBrains Mono,
// Bricolage Grotesque and Cormorant Garamond are variable fonts, so a single
// file covers all the weights below.
//
// Body/UI text uses the SF Pro system stack (--font-sans in
// tooling/tailwind/theme.css) instead of a loaded font: SF Pro is an Apple
// font that can't be legally self-hosted for the web, so `-apple-system` /
// `BlinkMacSystemFont` are used to resolve to real San Francisco on Apple
// devices, with native fallbacks elsewhere.

const serifFont = localFont({
	src: [
		{
			path: "../fonts/instrument-normal.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "../fonts/instrument-italic.woff2",
			weight: "400",
			style: "italic",
		},
	],
	display: "swap",
	variable: "--font-instrument",
	fallback: ["Georgia", "serif"],
});

const displayFont = Bricolage_Grotesque({
	weight: ["400", "500", "600", "700", "800"],
	subsets: ["latin"],
	variable: "--font-bricolage",
	fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
	metadataBase: new URL(getBaseUrl()),
	title: {
		absolute: config.appName,
		default: config.appName,
		template: `%s | ${config.appName}`,
	},
};

export default async function RootLayout({ children }: PropsWithChildren) {
	const { getLocale } = await import("next-intl/server");
	const locale = await getLocale().catch(() => "en");
	const baseUrl = getBaseUrl();
	const headerStore = await headers();
	const nonce = headerStore.get("x-nonce") ?? undefined;

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={cn(serifFont.variable, displayFont.variable)}
		>
			<body className="min-h-screen bg-background text-foreground antialiased">
				{enzuzoCookiebarId ? (
					// Cookie consent banner (Enzuzo). Loaded beforeInteractive, as
					// high as Next.js allows, so it sets Google Consent Mode
					// defaults before the GTM container (loaded afterInteractive
					// from the google analytics provider) evaluates any tags.
					// Enzuzo owns all consent state/UI now — see the "Consent Mode
					// - With GTM Template" install method in the Enzuzo dashboard.
					<Script
						src={`https://app.enzuzo.com/scripts/cookiebar/${enzuzoCookiebarId}`}
						strategy="beforeInteractive"
						nonce={nonce}
					/>
				) : null}
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, no user input
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "Organization",
							name: "Popsuites",
							alternateName: "Popsuites by PopPush AI",
							url: baseUrl,
							logo: {
								"@type": "ImageObject",
								url: `${baseUrl}/images/popsuites-icon.png`,
								width: 512,
								height: 512,
							},
							description:
								"AI-powered email management platform for Gmail and Outlook. Smart triage, inbox automation, and AI-drafted replies for professionals.",
							foundingDate: "2026",
							foundingLocation: "Bengaluru, India",
							parentOrganization: {
								"@type": "Organization",
								name: "PopPush AI Private Limited",
								url: "https://poppushai.com",
							},
							address: {
								"@type": "PostalAddress",
								addressLocality: "Bengaluru",
								addressRegion: "Karnataka",
								addressCountry: "IN",
							},
							contactPoint: {
								"@type": "ContactPoint",
								contactType: "customer support",
								url: `${baseUrl}/contact`,
							},
							sameAs: [
								"https://x.com/popsuites",
								"https://www.producthunt.com/products/zer0-email/launches/popsuites",
							],
						}),
					}}
				/>
				{children}
			</body>
		</html>
	);
}
