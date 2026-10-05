import { cn } from "@repo/ui";
import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import type { PropsWithChildren } from "react";
import "./globals.css";
import "cropperjs/dist/cropper.css";
import { config } from "@/config";

// Fonts are self-hosted from `./fonts` (see next/font/local) so dev/build never
// depends on reaching fonts.googleapis.com at compile time. DM Sans, JetBrains
// Mono, Bricolage Grotesque and Cormorant Garamond are variable fonts, so a
// single file covers all the weights below.

const sansFont = localFont({
	src: [
		{
			path: "../fonts/dmsans-normal.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "../fonts/dmsans-normal.woff2",
			weight: "500",
			style: "normal",
		},
		{
			path: "../fonts/dmsans-normal.woff2",
			weight: "600",
			style: "normal",
		},
		{
			path: "../fonts/dmsans-normal.woff2",
			weight: "700",
			style: "normal",
		},
	],
	display: "swap",
	variable: "--font-inter",
	fallback: ["system-ui", "sans-serif"],
});

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

	return (
		<html
			lang={locale}
			suppressHydrationWarning
			className={cn(
				sansFont.variable,
				serifFont.variable,
				displayFont.variable,
			)}
		>
			<body className="min-h-screen bg-background text-foreground antialiased">
				<script
					type="application/ld+json"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD, no user input
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "Organization",
							name: "Zer0Email",
							alternateName: "Zer0Email by PopPush AI",
							url: "https://zer0email.com",
							logo: {
								"@type": "ImageObject",
								url: "https://zer0email.com/logo.png",
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
								url: "https://zer0email.com/contact",
							},
							sameAs: [
								"https://www.wikidata.org/wiki/Q140377996",
								"https://www.crunchbase.com/organization/zer0email",
								"https://twitter.com/Zer0_Email",
								"https://www.linkedin.com/company/zer0email",
								"https://www.producthunt.com/products/zer0email",
							],
						}),
					}}
				/>
				{children}
			</body>
		</html>
	);
}
