import { ContactForm } from "@marketing/home/components/ContactForm";
import { getBaseUrl } from "@repo/utils";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();
	const url = `${getBaseUrl()}/contact`;
	return {
		title: t("contact.title"),
		description:
			"Get in touch with the Zer0Email team. We typically respond within one business day.",
		alternates: { canonical: url },
		openGraph: {
			title: t("contact.title"),
			url,
			siteName: "Zer0Email",
			type: "website",
		},
	};
}

export default async function ContactPage() {
	const t = await getTranslations();
	return (
		<div className="container max-w-xl pt-24 pb-16">
			<div className="mb-12 pt-8 text-center">
				<h1 className="mb-2 font-bold text-5xl">
					{t("contact.title")}
				</h1>
				<p className="text-balance text-lg opacity-50">
					{t("contact.description")}
				</p>
			</div>

			<ContactForm />
		</div>
	);
}
