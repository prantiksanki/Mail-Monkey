"use client";

import { AnalyticsScript } from "@analytics";
import { ProgressProvider } from "@bprogress/next/app";
import { Toaster } from "@repo/ui/components/toast";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ConsentBanner } from "@shared/components/ConsentBanner";
import { useCookieConsent } from "@shared/hooks/cookie-consent";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";
import { config } from "@/config";

function ConsentedAnalytics() {
	const { userHasConsented } = useCookieConsent();
	if (!userHasConsented) {
		return null;
	}
	return <AnalyticsScript />;
}

export function ClientProviders({
	children,
	nonce,
}: PropsWithChildren<{ nonce?: string }>) {
	return (
		<ApiClientProvider>
			<ProgressProvider
				height="4px"
				color="var(--color-primary)"
				options={{ showSpinner: false }}
				shallowRouting
				delay={250}
			>
				<ThemeProvider
					attribute="class"
					disableTransitionOnChange
					enableSystem
					defaultTheme={config.defaultTheme}
					themes={Array.from(config.enabledThemes)}
					nonce={nonce}
				>
					<ApiClientProvider>
						{children}

						<Toaster position="top-right" />
						<ConsentBanner />
						<ConsentedAnalytics />
					</ApiClientProvider>
				</ThemeProvider>
			</ProgressProvider>
		</ApiClientProvider>
	);
}
