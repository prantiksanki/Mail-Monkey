import { ClientProviders } from "@shared/components/ClientProviders";
import { ConsentProvider } from "@shared/components/ConsentProvider";
import { cookies, headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { PropsWithChildren } from "react";

export async function Document({
	children,
	locale: _locale,
}: PropsWithChildren<{ locale?: string }>) {
	const cookieStore = await cookies();
	const consentCookie = cookieStore.get("consent");
	const headerStore = await headers();
	const nonce = headerStore.get("x-nonce") ?? undefined;

	return (
		<NuqsAdapter>
			<ConsentProvider initialConsent={consentCookie?.value === "true"}>
				<ClientProviders nonce={nonce}>{children}</ClientProviders>
			</ConsentProvider>
		</NuqsAdapter>
	);
}
