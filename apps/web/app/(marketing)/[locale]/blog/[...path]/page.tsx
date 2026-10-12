import { LocaleLink, localeRedirect } from "@i18n/routing";
import { PostContent } from "@marketing/blog/components/PostContent";
import { getPostBySlug } from "@marketing/blog/utils/lib/posts";
import { getBaseUrl } from "@repo/utils";
import { BreadcrumbJsonLd } from "@shared/components/BreadcrumbJsonLd";
import { getActivePathFromUrlParam } from "@shared/lib/content";
import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import { getLocale, getTranslations, setRequestLocale } from "next-intl/server";

type Params = {
	path: string;
	locale: string;
};

export async function generateMetadata(props: { params: Promise<Params> }) {
	const params = await props.params;
	const { path } = params;
	const locale = await getLocale();
	const slug = getActivePathFromUrlParam(path);
	const post = await getPostBySlug(slug, { locale });

	return {
		title: post?.title,
		description: post?.excerpt,
		alternates: { canonical: `${getBaseUrl()}/blog/${slug}` },
		openGraph: {
			title: post?.title,
			description: post?.excerpt,
			images: [
				post?.image
					? post.image.startsWith("http")
						? post.image
						: new URL(post.image, getBaseUrl()).toString()
					: "/opengraph-image",
			],
		},
	};
}

export default async function BlogPostPage(props: { params: Promise<Params> }) {
	const { path, locale } = await props.params;
	setRequestLocale(locale);

	const t = await getTranslations();
	const slug = getActivePathFromUrlParam(path);
	const post = await getPostBySlug(slug, { locale });

	if (!post) {
		return localeRedirect({ href: "/blog", locale });
	}

	const {
		title,
		date,
		authorName,
		authorImage,
		authorLink,
		tags,
		image,
		body,
		excerpt,
	} = post;

	const formattedDate = Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(new Date(date));

	const baseUrl = getBaseUrl();
	const postUrl = `${baseUrl}/blog/${slug}`;
	const blogPosting = {
		"@context": "https://schema.org",
		"@type": "BlogPosting",
		headline: title,
		description: excerpt,
		datePublished: date,
		mainEntityOfPage: postUrl,
		url: postUrl,
		image: image
			? image.startsWith("http")
				? image
				: new URL(image, baseUrl).toString()
			: undefined,
		author: {
			"@type": "Person",
			name: authorName,
			...(authorLink ? { url: authorLink } : {}),
		},
		publisher: {
			"@type": "Organization",
			name: "Popsuites",
			logo: {
				"@type": "ImageObject",
				url: `${baseUrl}/images/popsuites-icon.png`,
			},
		},
	};

	return (
		<article className="pt-28 pb-24">
			<script
				type="application/ld+json"
				// biome-ignore lint/security/noDangerouslySetInnerHtml: structured data
				dangerouslySetInnerHTML={{
					__html: JSON.stringify(blogPosting),
				}}
			/>
			<BreadcrumbJsonLd
				items={[
					{ name: "Home", url: baseUrl },
					{ name: "Blog", url: `${baseUrl}/blog` },
					{ name: title, url: postUrl },
				]}
			/>
			{/* Back link */}
			<div className="container max-w-3xl mb-10">
				<LocaleLink
					href="/blog"
					className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-secondary transition-colors"
				>
					<ArrowLeft className="size-4" />
					{t("blog.back")}
				</LocaleLink>
			</div>

			{/* Article header */}
			<header className="container max-w-3xl mb-10">
				{tags && tags.length > 0 && (
					<div className="mb-4 flex flex-wrap gap-2">
						{tags.map((tag) => (
							<span
								key={tag}
								className="rounded-full border border-border bg-secondary px-3 py-0.5 font-medium text-xs uppercase tracking-widest text-muted-foreground"
							>
								{tag}
							</span>
						))}
					</div>
				)}

				<h1 className="font-[family-name:var(--font-bricolage)] font-bold text-4xl md:text-5xl leading-tight tracking-tight text-foreground">
					{title}
				</h1>

				{excerpt && (
					<p className="mt-4 text-lg leading-relaxed text-muted-foreground">
						{excerpt}
					</p>
				)}

				<div className="mt-6 flex items-center gap-3 border-t border-border pt-6">
					{authorImage && (
						<div className="relative size-9 overflow-hidden rounded-full ring-2 ring-border">
							<Image
								src={authorImage}
								alt={authorName ?? ""}
								fill
								sizes="36px"
								className="object-cover"
							/>
						</div>
					)}
					<div className="flex flex-col">
						{authorName &&
							(authorLink ? (
								<a
									href={authorLink}
									target="_blank"
									rel="noopener noreferrer"
									className="font-semibold text-sm text-foreground hover:underline"
								>
									{authorName}
								</a>
							) : (
								<span className="font-semibold text-sm text-foreground">
									{authorName}
								</span>
							))}
						<time className="text-xs text-muted-foreground">
							{formattedDate}
						</time>
					</div>
				</div>
			</header>

			{/* Hero image */}
			{image && (
				<div className="container max-w-5xl mb-12">
					<div className="relative aspect-[21/9] overflow-hidden rounded-3xl bg-muted shadow-sm">
						<Image
							src={image}
							alt={title}
							fill
							sizes="(max-width: 768px) 100vw, 1200px"
							className="object-cover object-center"
							priority
						/>
					</div>
				</div>
			)}

			{/* Article body */}
			<div className="container max-w-3xl">
				<PostContent content={body} />
			</div>

			{/* Footer CTA */}
			<div className="container max-w-3xl mt-16">
				<div className="rounded-3xl border border-border bg-card p-8 text-center">
					<p className="font-semibold text-lg text-foreground mb-2">
						Try Popsuites free
					</p>
					<p className="text-muted-foreground text-sm mb-6">
						Connect Gmail or Outlook and let AI handle the noise.
					</p>
					<LocaleLink
						href="/auth/signup"
						className="inline-flex items-center justify-center rounded-full bg-foreground px-6 py-2.5 text-sm font-semibold text-background hover:opacity-90 transition-opacity"
					>
						Get started — it's free
					</LocaleLink>
				</div>
			</div>
		</article>
	);
}
