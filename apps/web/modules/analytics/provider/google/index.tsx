"use client";

import { GoogleAnalytics, sendGAEvent } from "@next/third-parties/google";
import Script from "next/script";

const googleTagId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

export function AnalyticsScript() {
	return (
		<>
			{googleTagId ? <GoogleAnalytics gaId={googleTagId} /> : null}
			{googleAdsId ? (
				<Script id="google-ads-config" strategy="afterInteractive">
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
		// GA4 requires the literal "event" command as the first argument.
		// Passing the event name directly is not a valid gtag command and
		// is silently dropped.
		sendGAEvent("event", event, data ?? {});
	};

	return {
		trackEvent,
	};
}
