"use client";

import { MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import {
	CATEGORY_CONFIG,
	DashboardCategoryDonut,
	type DashboardCategoryKey,
} from "./DashboardCategoryDonut";

interface DashboardInboxOverviewProps {
	categoryBreakdown: Array<{ category: DashboardCategoryKey; count: number }>;
	categorizedTotal: number;
	uncategorizedCount: number;
}

const CATEGORY_ORDER: DashboardCategoryKey[] = [
	"PRIMARY",
	"NEWSLETTER",
	"PROMOTION",
	"SOCIAL",
];

export function DashboardInboxOverview({
	categoryBreakdown,
	categorizedTotal,
	uncategorizedCount,
}: DashboardInboxOverviewProps) {
	const t = useTranslations();
	const countByCategory = new Map(
		categoryBreakdown.map((c) => [c.category, c.count]),
	);
	const rows = CATEGORY_ORDER.map((category) => ({
		category,
		count: countByCategory.get(category) ?? 0,
	}));

	const isEmpty = categorizedTotal === 0 && uncategorizedCount === 0;

	return (
		<div className="flex flex-col gap-2 rounded-[26px] border border-border bg-card p-5 shadow-[0_18px_40px_rgba(15,23,42,0.03)]">
			<div className="mb-2 flex items-center justify-between">
				<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
					{t("dashboard.inboxOverview.title")}
				</p>
			</div>

			{isEmpty ? (
				<div className="flex min-h-[150px] flex-col items-center justify-center text-center">
					<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<MailIcon className="size-5" />
					</div>
					<p className="text-sm text-foreground/72">
						{t("dashboard.inboxOverview.empty")}
					</p>
				</div>
			) : (
				<div className="flex flex-wrap items-center gap-6">
					<DashboardCategoryDonut
						data={rows.filter((r) => r.count > 0)}
						total={categorizedTotal}
					/>
					<div className="flex flex-1 flex-col gap-3 min-w-[160px]">
						{rows.map((row) => (
							<div
								key={row.category}
								className="flex items-center justify-between text-sm"
							>
								<span className="flex items-center gap-2 text-foreground/72">
									<span
										className="size-2 shrink-0 rounded-full"
										style={{
											backgroundColor:
												CATEGORY_CONFIG[row.category]
													.color,
										}}
									/>
									{CATEGORY_CONFIG[row.category].label}
								</span>
								<span className="font-medium tabular-nums">
									{row.count}
								</span>
							</div>
						))}
						{uncategorizedCount > 0 && (
							<p className="mt-1 text-foreground/40 text-xs">
								{t("dashboard.inboxOverview.stillClassifying", {
									count: uncategorizedCount,
								})}
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
