"use client";

import { SparklesIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface DashboardAiInsightProps {
	insight: string;
}

export function DashboardAiInsight({ insight }: DashboardAiInsightProps) {
	const t = useTranslations();

	return (
		<div className="flex items-center gap-4 rounded-[26px] border border-border bg-card p-5 shadow-[0_18px_40px_rgba(15,23,42,0.03)]">
			<div
				className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-white"
				style={{
					backgroundImage: "var(--sidebar-item-active-gradient)",
				}}
			>
				<SparklesIcon className="size-5" />
			</div>
			<div className="min-w-0 flex-1">
				<p className="font-mono text-[11px] text-primary uppercase tracking-[0.24em]">
					{t("dashboard.aiInsight.title")}
				</p>
				<p className="mt-1 text-[15px] text-foreground/80 leading-6">
					{insight}
				</p>
			</div>
		</div>
	);
}
