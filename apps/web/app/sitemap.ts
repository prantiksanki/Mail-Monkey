import { getAllPosts } from "@marketing/blog/utils/lib/posts";
import { getBaseUrl } from "@repo/utils";
import { allLegalPages } from "content-collections";
import type { MetadataRoute } from "next";

const baseUrl = getBaseUrl();

// lastModified values reflect the last real content change to each route,
// not build time - identical build-time stamps across every URL was flagged
// as a crawl-prioritization issue in the July 2026 SEO audit.
const staticPages = [
	{
		path: "/",
		priority: 1.0,
		changeFrequency: "weekly" as const,
		lastModified: "2026-07-28",
	},
	{
		path: "/pricing",
		priority: 0.8,
		changeFrequency: "monthly" as const,
		lastModified: "2026-07-28",
	},
	{
		path: "/blog",
		priority: 0.7,
		changeFrequency: "weekly" as const,
		lastModified: "2026-07-28",
	},
	{
		path: "/about",
		priority: 0.7,
		changeFrequency: "monthly" as const,
		lastModified: "2026-07-28",
	},
	{
		path: "/contact",
		priority: 0.5,
		changeFrequency: "monthly" as const,
		lastModified: "2026-07-09",
	},
	{
		path: "/security",
		priority: 0.5,
		changeFrequency: "monthly" as const,
		lastModified: "2026-07-28",
	},
	{
		path: "/integrations/zoom",
		priority: 0.6,
		changeFrequency: "monthly" as const,
		lastModified: "2026-08-23",
	},
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const posts = await getAllPosts();

	return [
		...staticPages.map(
			({ path, priority, changeFrequency, lastModified }) => ({
				url: new URL(path, baseUrl).href,
				lastModified: new Date(lastModified),
				changeFrequency,
				priority,
			}),
		),
		...posts
			.filter((post) => post.published)
			.map((post) => ({
				url: new URL(`/blog/${post.path}`, baseUrl).href,
				lastModified: new Date(post.date),
				changeFrequency: "monthly" as const,
				priority: 0.6,
			})),
		...allLegalPages.map((page) => ({
			url: new URL(`/legal/${page.path}`, baseUrl).href,
			lastModified: new Date(page.lastUpdated ?? Date.now()),
			changeFrequency: "yearly" as const,
			priority: 0.3,
		})),
	];
}
