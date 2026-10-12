"use client";

import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import { isStagingEnvironment } from "@repo/utils";
import Script from "next/script";

// Staging traffic is development activity, not real usage, so it's never
// reported to GA4 — the container/tag ids are treated as unset there.
const isStaging = isStagingEnvironment();
const googleTagId = isStaging
	? undefined
	: process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
const googleAdsId = isStaging
	? undefined
	: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
const gtmContainerId = isStaging
	? undefined
	: process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID;

interface AnalyticsScriptProps {
	nonce?: string;
}

// Consent (Google Consent Mode defaults/updates) is owned by the Enzuzo
// cookie banner, loaded beforeInteractive in the root layout — it pushes
// `consent default` before this script runs and `consent update` whenever
// the visitor's choice changes. This provider just needs to get the GTM
// container itself onto the page; it doesn't manage consent state.
export function AnalyticsScript({ nonce }: AnalyticsScriptProps = {}) {
	return (
		<>
			{gtmContainerId ? (
				<Script id="gtm-init" strategy="afterInteractive" nonce={nonce}>
					{`
						(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
						new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
						j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
						'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
						})(window,document,'script','dataLayer','${gtmContainerId}');
					`}
				</Script>
			) : null}
			{googleTagId ? <GoogleAnalytics gaId={googleTagId} /> : null}
			{googleAdsId ? (
				<Script
					id="google-ads-config"
					strategy="afterInteractive"
					nonce={nonce}
				>
					{`
						window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());
						gtag('config', '${googleAdsId}');
					`}
				</Script>
			) : null}
		</>
	);
}

export function useAnalytics() {
	const trackEvent = (event: string, data?: Record<string, unknown>) => {
		if (isStaging) {
			return;
		}
		// GA4 requires the literal "event" command as the first argument.
		// Passing the event name directly is not a valid gtag command and
		// is silently dropped.
		sendGAEvent("event", event, data ?? {});
	};

	return {
		trackEvent,
	};
}
