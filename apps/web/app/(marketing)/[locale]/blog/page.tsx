import { PostListItem } from "@marketing/blog/components/PostListItem";
import { getAllPosts } from "@marketing/blog/utils/lib/posts";
import { getBaseUrl } from "@repo/utils";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata() {
	const t = await getTranslations();
	return {
		title: t("blog.title"),
		description: t("blog.description"),
		alternates: { canonical: `${getBaseUrl()}/blog` },
	};
}

export default async function BlogListPage() {
	const locale = await getLocale();
	const t = await getTranslations();

	const posts = await getAllPosts();

	return (
		<div className="container max-w-6xl pt-24 pb-16">
			<div className="mb-12 pt-8 text-center">
				<h1 className="mb-2 font-[family-name:var(--font-bricolage)] font-bold text-5xl">
					{t("blog.title")}
				</h1>
				<p className="text-lg opacity-50">{t("blog.description")}</p>
			</div>

			<div className="grid gap-8 md:grid-cols-2">
				{posts
					.filter((post) => post.published && locale === post.locale)
					.sort(
						(a, b) =>
							new Date(b.date).getTime() -
							new Date(a.date).getTime(),
					)
					.map((post, index) => (
						<PostListItem
							post={post}
							priority={index === 0}
							key={post.path}
						/>
					))}
			</div>
		</div>
	);
}
