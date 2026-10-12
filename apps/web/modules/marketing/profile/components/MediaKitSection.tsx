"use client";

import { useTranslations } from "next-intl";

interface MediaKit {
	stats?: { label: string; value: string }[];
	collaborations?: { label: string; url?: string }[];
	rateCard?: { label: string; price: string }[];
}

export function MediaKitSection({ mediaKit }: { mediaKit: MediaKit }) {
	const t = useTranslations();

	const hasStats = (mediaKit.stats?.length ?? 0) > 0;
	const hasCollaborations = (mediaKit.collaborations?.length ?? 0) > 0;
	const hasRateCard = (mediaKit.rateCard?.length ?? 0) > 0;

	if (!hasStats && !hasCollaborations && !hasRateCard) {
		return null;
	}

	return (
		<div className="mx-auto mt-6 max-w-md rounded-2xl border border-border bg-card p-6">
			<h2 className="mb-4 font-semibold text-lg">
				{t("profile.mediaKit.title")}
			</h2>

			{hasStats && (
				<div className="mb-6 grid grid-cols-3 gap-4">
					{mediaKit.stats?.map((stat) => (
						<div key={stat.label} className="text-center">
							<div className="font-bold text-xl">
								{stat.value}
							</div>
							<div className="text-foreground/60 text-xs">
								{stat.label}
							</div>
						</div>
					))}
				</div>
			)}

			{hasCollaborations && (
				<div className="mb-6">
					<p className="mb-2 font-medium text-foreground/60 text-xs uppercase tracking-wide">
						{t("profile.mediaKit.collaborations")}
					</p>
					<div className="flex flex-wrap gap-2">
						{mediaKit.collaborations?.map((collab) =>
							collab.url ? (
								<a
									key={collab.label}
									href={collab.url}
									target="_blank"
									rel="noopener noreferrer nofollow"
									className="rounded-full border border-border px-3 py-1 text-sm hover:bg-background"
								>
									{collab.label}
								</a>
							) : (
								<span
									key={collab.label}
									className="rounded-full border border-border px-3 py-1 text-sm"
								>
									{collab.label}
								</span>
							),
						)}
					</div>
				</div>
			)}

			{hasRateCard && (
				<div>
					<p className="mb-2 font-medium text-foreground/60 text-xs uppercase tracking-wide">
						{t("profile.mediaKit.rateCard")}
					</p>
					<div className="flex flex-col gap-2">
						{mediaKit.rateCard?.map((item) => (
							<div
								key={item.label}
								className="flex items-center justify-between text-sm"
							>
								<span>{item.label}</span>
								<span className="font-medium">
									{item.price}
								</span>
							</div>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
