import { DirectoryBrowser } from "@marketing/profile/components/DirectoryBrowser";
import { getBaseUrl } from "@repo/utils";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

export function generateMetadata(): Metadata {
	const url = `${getBaseUrl()}/u`;
	const title = "Creator & Freelancer Directory";
	const description =
		"Browse creators and freelancers who've made their public page discoverable.";

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: { title, description, url, type: "website" },
		twitter: { card: "summary", title, description },
	};
}

export default async function DirectoryPage({
	params,
}: {
	params: Promise<{ locale: string }>;
}) {
	const { locale } = await params;
	setRequestLocale(locale);

	return (
		<div className="container max-w-4xl px-6 pt-24 pb-20">
			<DirectoryBrowser />
		</div>
	);
}
