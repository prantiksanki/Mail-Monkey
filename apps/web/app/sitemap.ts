import { getAllPosts } from "@marketing/blog/utils/lib/posts";
import { getBaseUrl } from "@repo/utils";
import { allLegalPages } from "content-collections";
import type { MetadataRoute } from "next";

const baseUrl = getBaseUrl();

const staticPages = [
	{ path: "/", priority: 1.0, changeFrequency: "weekly" as const },
	{ path: "/pricing", priority: 0.8, changeFrequency: "monthly" as const },
	{ path: "/blog", priority: 0.7, changeFrequency: "weekly" as const },
	{ path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
	{
		path: "/auth/login",
		priority: 0.6,
		changeFrequency: "monthly" as const,
	},
	{
		path: "/auth/signup",
		priority: 0.6,
		changeFrequency: "monthly" as const,
	},
	{ path: "/contact", priority: 0.5, changeFrequency: "monthly" as const },
	{ path: "/security", priority: 0.5, changeFrequency: "monthly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const posts = await getAllPosts();

	return [
		...staticPages.map(({ path, priority, changeFrequency }) => ({
			url: new URL(path, baseUrl).href,
			lastModified: new Date(),
			changeFrequency,
			priority,
		})),
		...posts
			.filter((post) => post.published)
			.map((post) => ({
				url: new URL(`/blog/${post.path}`, baseUrl).href,
				lastModified: new Date(),
				changeFrequency: "monthly" as const,
				priority: 0.6,
			})),
		...allLegalPages.map((page) => ({
			url: new URL(`/legal/${page.path}`, baseUrl).href,
			lastModified: new Date(),
			changeFrequency: "yearly" as const,
			priority: 0.3,
		})),
	];
}
