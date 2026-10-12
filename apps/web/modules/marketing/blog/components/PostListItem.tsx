"use client";

import { LocaleLink } from "@i18n/routing";
import type { Post } from "@marketing/blog/types";
import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";

export function PostListItem({
	post,
	priority = false,
}: {
	post: Post;
	priority?: boolean;
}) {
	const { title, excerpt, authorName, image, date, path, tags } = post;
	const category = tags?.[0];

	return (
		<LocaleLink
			href={`/blog/${path}`}
			className="group block cursor-pointer overflow-hidden rounded-2xl border border-border bg-white transition-shadow duration-300 hover:shadow-md"
		>
			{image && (
				<div className="relative aspect-video overflow-hidden">
					<Image
						src={image}
						alt={title}
						fill
						sizes="(max-width: 768px) 100vw, 50vw"
						className="object-cover object-center"
						priority={priority}
					/>
					{category && (
						<span className="absolute top-0 left-0 bg-white px-3 py-1 text-xs font-medium uppercase text-[#00388F]">
							{category}
						</span>
					)}
				</div>
			)}

			<div className="p-4 lg:p-6">
				<h3 className="font-[family-name:var(--font-bricolage)] text-lg font-normal tracking-tight text-foreground md:text-xl">
					{title}
				</h3>
				{authorName && (
					<p className="mt-1 text-xs text-muted-foreground">
						{authorName}
					</p>
				)}
				{excerpt && (
					<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
						{excerpt}
					</p>
				)}

				<div className="mt-4 flex items-center justify-between">
					<div className="flex items-center gap-3">
						<div className="relative size-9 shrink-0 overflow-hidden border border-border transition-colors duration-300 group-hover:bg-[#0663DA]">
							<ArrowRightIcon className="absolute inset-0 m-auto size-4 text-foreground transition-all duration-300 group-hover:translate-x-8 group-hover:opacity-0" />
							<ArrowRightIcon className="-left-6 absolute inset-y-0 m-auto size-4 text-white opacity-0 transition-all duration-300 group-hover:left-2 group-hover:opacity-100" />
						</div>
						<span className="text-sm font-medium text-foreground">
							Read more
						</span>
					</div>

					<div className="flex items-center gap-2">
						<span className="h-px w-6 bg-border" />
						<p className="text-sm text-muted-foreground">
							{Intl.DateTimeFormat("en-US").format(
								new Date(date),
							)}
						</p>
					</div>
				</div>
			</div>
		</LocaleLink>
	);
}
