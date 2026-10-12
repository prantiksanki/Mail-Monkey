"use client";

import { AnalyticsScript } from "@analytics";
import { ProgressProvider } from "@bprogress/next/app";
import { Toaster } from "@repo/ui/components/toast";
import { ApiClientProvider } from "@shared/components/ApiClientProvider";
import { ThemeProvider } from "next-themes";
import type { PropsWithChildren } from "react";
import { config } from "@/config";

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
						{/*
							No custom cookie banner here: the Enzuzo script (loaded
							beforeInteractive in the root layout) renders its own banner
							and owns all consent state via Google Consent Mode.
						*/}
						<AnalyticsScript nonce={nonce} />
					</ApiClientProvider>
				</ThemeProvider>
			</ProgressProvider>
		</ApiClientProvider>
	);
}
