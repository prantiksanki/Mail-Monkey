"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function DirectoryBrowser() {
	const t = useTranslations();
	const [activeTag, setActiveTag] = useState<string | undefined>(undefined);

	const tagsQuery = useQuery(
		orpc.creatorProfiles.getDirectoryTags.queryOptions(),
	);

	const directoryQuery = useInfiniteQuery({
		...orpc.creatorProfiles.listDirectory.infiniteOptions({
			input: (cursor: string | undefined) => ({
				tag: activeTag,
				cursor,
				limit: 24,
			}),
			getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
			initialPageParam: undefined,
		}),
	});

	const entries = directoryQuery.data?.pages.flatMap((p) => p.entries) ?? [];

	return (
		<div>
			<div className="mb-8">
				<h1 className="font-bold text-3xl tracking-tight">
					{t("directory.title")}
				</h1>
				<p className="mt-2 text-foreground/60">
					{t("directory.description")}
				</p>
			</div>

			{tagsQuery.data && tagsQuery.data.length > 0 && (
				<div className="mb-8 flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => setActiveTag(undefined)}
						className={`rounded-full border px-3 py-1.5 text-sm ${
							!activeTag
								? "border-foreground bg-foreground text-background"
								: "border-border hover:bg-card"
						}`}
					>
						{t("directory.allTags")}
					</button>
					{tagsQuery.data.map((tag) => (
						<button
							key={tag}
							type="button"
							onClick={() => setActiveTag(tag)}
							className={`rounded-full border px-3 py-1.5 text-sm ${
								activeTag === tag
									? "border-foreground bg-foreground text-background"
									: "border-border hover:bg-card"
							}`}
						>
							{tag}
						</button>
					))}
				</div>
			)}

			{directoryQuery.isLoading && (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Skeleton key={i} className="h-40" />
					))}
				</div>
			)}

			{!directoryQuery.isLoading && entries.length === 0 && (
				<p className="text-foreground/60">{t("directory.empty")}</p>
			)}

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{entries.map((entry) => (
					<Link
						key={entry.username}
						href={`/u/${entry.username}`}
						className="rounded-2xl border border-border bg-card p-5 transition-colors hover:bg-background"
					>
						<div className="flex items-center gap-3">
							{entry.image ? (
								<Image
									src={entry.image}
									alt={entry.name}
									width={44}
									height={44}
									className="rounded-full"
								/>
							) : (
								<div
									className="flex h-11 w-11 items-center justify-center rounded-full text-background text-sm"
									style={{
										backgroundColor: entry.accentColor,
									}}
								>
									{entry.name.charAt(0).toUpperCase()}
								</div>
							)}
							<div className="min-w-0">
								<p className="truncate font-medium">
									{entry.name}
								</p>
								<p className="truncate text-foreground/50 text-sm">
									@{entry.username}
								</p>
							</div>
						</div>
						{entry.bio && (
							<p className="mt-3 line-clamp-2 text-foreground/70 text-sm">
								{entry.bio}
							</p>
						)}
						{entry.tags.length > 0 && (
							<div className="mt-3 flex flex-wrap gap-1.5">
								{entry.tags.slice(0, 3).map((tag) => (
									<span
										key={tag}
										className="rounded-full bg-background px-2 py-0.5 text-foreground/60 text-xs"
									>
										{tag}
									</span>
								))}
							</div>
						)}
					</Link>
				))}
			</div>

			{directoryQuery.hasNextPage && (
				<div className="mt-8 flex justify-center">
					<Button
						variant="outline"
						loading={directoryQuery.isFetchingNextPage}
						onClick={() => directoryQuery.fetchNextPage()}
					>
						{t("directory.loadMore")}
					</Button>
				</div>
			)}
		</div>
	);
}
