"use client";

import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

export function SimilarCreators({ username }: { username: string }) {
	const t = useTranslations();
	const similarQuery = useQuery(
		orpc.creatorProfiles.getSimilarProfiles.queryOptions({
			input: { username },
		}),
	);

	if (!similarQuery.data || similarQuery.data.length === 0) {
		return null;
	}

	return (
		<div className="mx-auto mt-6 max-w-md">
			<p className="mb-3 font-medium text-foreground/60 text-xs uppercase tracking-wide">
				{t("profile.similarCreators.title")}
			</p>
			<div className="flex flex-col gap-2">
				{similarQuery.data.map((creator) => (
					<Link
						key={creator.username}
						href={`/u/${creator.username}`}
						className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-background"
					>
						{creator.image ? (
							<Image
								src={creator.image}
								alt={creator.name}
								width={36}
								height={36}
								className="rounded-full"
							/>
						) : (
							<div
								className="flex h-9 w-9 items-center justify-center rounded-full text-background text-sm"
								style={{ backgroundColor: creator.accentColor }}
							>
								{creator.name.charAt(0).toUpperCase()}
							</div>
						)}
						<div className="min-w-0">
							<p className="truncate font-medium text-sm">
								{creator.name}
							</p>
							<p className="truncate text-foreground/50 text-xs">
								@{creator.username}
							</p>
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}
