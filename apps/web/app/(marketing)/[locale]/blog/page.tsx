import { getBaseUrl } from "@repo/utils";
import { getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();
	return {
		title: t("blog.title"),
		description: t("blog.description"),
		alternates: { canonical: `${getBaseUrl()}/blog` },
	};
}

export default async function BlogListPage() {
	const t = await getTranslations();

	return (
		<div className="container max-w-6xl pt-24 pb-16">
			<div className="mb-12 pt-8 text-center">
				<h1 className="mb-2 font-[family-name:var(--font-bricolage)] font-bold text-5xl">
					{t("blog.title")}
				</h1>
				<p className="text-lg opacity-50">{t("blog.description")}</p>
			</div>
		</div>
	);
}
