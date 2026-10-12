import { ClientProviders } from "@shared/components/ClientProviders";
import { headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";

const gtmContainerId = process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID;

export async function Document({
	children,
	locale: _locale,
}: PropsWithChildren<{ locale?: string }>) {
	const headerStore = await headers();
	const nonce = headerStore.get("x-nonce") ?? undefined;

	return (
		<>
			{gtmContainerId ? (
				// Standard GTM noscript fallback for visitors with JavaScript
				// disabled. Placed as high in <body> as this layout allows.
				// Rendered unconditionally: the GTM container is always present
				// (required for Google's tag detection and for Consent Mode
				// signals to reach it at all), with consent enforced by the
				// Enzuzo banner (see root layout) and by tags inside GTM, not by
				// hiding this fallback.
				<noscript>
					<iframe
						src={`https://www.googletagmanager.com/ns.html?id=${gtmContainerId}`}
						height="0"
						width="0"
						style={{ display: "none", visibility: "hidden" }}
						title="Google Tag Manager"
					/>
				</noscript>
			) : null}
			<NuqsAdapter>
				<ClientProviders nonce={nonce}>{children}</ClientProviders>
			</NuqsAdapter>
		</>
	);
}
