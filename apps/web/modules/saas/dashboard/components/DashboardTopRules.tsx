"use client";

import { WandSparklesIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface TopRule {
	id: string;
	name: string;
	count: number;
}

interface DashboardTopRulesProps {
	rules: TopRule[];
}

export function DashboardTopRules({ rules }: DashboardTopRulesProps) {
	const t = useTranslations();
	const top = rules.slice(0, 3);

	return (
		<section>
			<div className="mb-4 flex items-end justify-between">
				<div>
					<h2 className="font-serif font-normal text-[2rem] tracking-[-0.04em]">
						{t("dashboard.topRules.heading")}
					</h2>
					<p className="font-mono text-foreground/50 text-xs uppercase tracking-wider">
						{t("dashboard.topRules.subheading")}
					</p>
				</div>
				<Link
					href="/app/rules"
					className="text-foreground/60 text-sm transition-colors hover:text-primary-deep"
				>
					{t("dashboard.topRules.viewAll")} →
				</Link>
			</div>

			{top.length === 0 ? (
				<div className="flex min-h-[150px] flex-col items-center justify-center rounded-[26px] border border-border bg-card px-6 py-10 text-center text-foreground/60 text-sm shadow-[0_16px_35px_rgba(15,23,42,0.035)]">
					<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<WandSparklesIcon className="size-5" />
					</div>
					<p className="text-sm text-foreground/72">
						{t("dashboard.topRules.empty")}
					</p>
					<p className="mt-2 max-w-md text-xs leading-6 text-foreground/48">
						Your strongest rules will surface here once they start
						sorting, labeling, or replying consistently.
					</p>
				</div>
			) : (
				<div className="grid gap-3 md:grid-cols-3">
					{top.map((rule) => (
						<div
							key={rule.id}
							className="flex flex-col gap-2 rounded-[24px] border border-border bg-card p-5 shadow-[0_16px_35px_rgba(15,23,42,0.03)]"
						>
							<p className="truncate font-medium text-sm">
								{rule.name}
							</p>
							<p className="font-serif font-normal text-3xl leading-none tracking-tight">
								{t("dashboard.topRules.fires", {
									count: rule.count,
								})}
							</p>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
