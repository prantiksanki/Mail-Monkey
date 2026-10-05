import { LocaleLink, localeRedirect } from "@i18n/routing";
import { PostContent } from "@marketing/blog/components/PostContent";
import {
	getActivePathFromUrlParam,
	getLocalizedDocumentWithFallback,
} from "@shared/lib/content";
import { allLegalPages } from "content-collections";
import { ArrowLeft } from "lucide-react";
import { getLocale } from "next-intl/server";

type Params = {
	path: string;
	locale: string;
};

export async function generateMetadata(props: { params: Promise<Params> }) {
	const params = await props.params;

	const { path } = params;

	const locale = await getLocale();
	const activePath = getActivePathFromUrlParam(path);
	const page = getLocalizedDocumentWithFallback(
		allLegalPages,
		activePath,
		locale,
	);

	return {
		title: page?.title,
		openGraph: {
			title: page?.title,
		},
	};
}

export default async function BlogPostPage(props: { params: Promise<Params> }) {
	const params = await props.params;

	const { path } = params;

	const locale = await getLocale();
	const activePath = getActivePathFromUrlParam(path);
	const page = getLocalizedDocumentWithFallback(
		allLegalPages,
		activePath,
		locale,
	);

	if (!page) {
		localeRedirect({ href: "/", locale });
	}

	const { title, body } = page;

	return (
		<div className="container max-w-3xl pt-28 pb-24">
			<div className="mb-10">
				<LocaleLink
					href="/"
					className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-secondary transition-colors"
				>
					<ArrowLeft className="size-4" />
					Back to Home
				</LocaleLink>
			</div>

			<div className="mb-12">
				<h1 className="font-bold text-4xl md:text-5xl leading-tight tracking-tight text-foreground">
					{title}
				</h1>
			</div>

			<PostContent content={body} />
		</div>
	);
}
