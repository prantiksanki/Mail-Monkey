"use client";

import { cn } from "@repo/ui";
import { Button } from "@repo/ui/components/button";
import { Switch } from "@repo/ui/components/switch";
import { PlusIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface RulesPageHeaderProps {
	mailboxEmail: string;
	activeCount: number;
	pausedCount: number;
	watchEnabled: boolean;
	canWatch: boolean;
	onWatchToggle: (enabled: boolean) => void;
	watchPending: boolean;
	onCreate: () => void;
}

export function RulesPageHeader({
	mailboxEmail,
	activeCount,
	pausedCount,
	watchEnabled,
	canWatch,
	onWatchToggle,
	watchPending,
	onCreate,
}: RulesPageHeaderProps) {
	const t = useTranslations();
	const totalCount = activeCount + pausedCount;

	return (
		<div className="flex flex-col gap-6 pb-8 lg:flex-row lg:items-end lg:justify-between">
			<div className="min-w-0">
				<p className="font-mono text-foreground text-xs uppercase tracking-wider">
					{t("rules.pageHeader.eyebrow")}
				</p>
				<h1 className="mt-2 text-balance font-serif font-normal text-4xl leading-[1.05] tracking-tight md:text-5xl">
					{t("rules.title")}
				</h1>
				<p className="mt-3 max-w-xl text-foreground text-sm">
					{totalCount === 0
						? t("rules.pageHeader.subtitleEmpty")
						: t("rules.pageHeader.subtitle", {
								count: totalCount,
								email: mailboxEmail,
							})}
				</p>
			</div>

			<div className="flex flex-col gap-3 lg:items-end">
				<div className="flex flex-wrap items-center gap-2">
					<span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary-soft px-3 py-1 font-mono text-primary-deep text-xs uppercase tracking-wider">
						<span className="size-1.5 rounded-full bg-primary" />
						{t("rules.pageHeader.active", { count: activeCount })}
					</span>
					<span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 font-mono text-foreground text-xs uppercase tracking-wider">
						{t("rules.pageHeader.paused", { count: pausedCount })}
					</span>
					<span
						className={cn(
							"inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider",
							watchEnabled
								? "border-primary/30 bg-primary-soft text-primary-deep"
								: "border-border bg-muted text-foreground",
						)}
					>
						<Switch
							checked={watchEnabled}
							onCheckedChange={onWatchToggle}
							disabled={!canWatch || watchPending}
							aria-label={t("rules.pageHeader.watching")}
						/>
						{watchEnabled
							? t("rules.pageHeader.watching")
							: t("rules.pageHeader.notWatching")}
						{!canWatch && (
							<span className="text-foreground">
								· {t("rules.pageHeader.watchRequiresPro")}
							</span>
						)}
					</span>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<Button asChild variant="secondary" size="sm">
						<Link href="/app/rules/assistant">
							<SparklesIcon className="size-4" />
							{t("rules.createWithAi")}
						</Link>
					</Button>
					<Button variant="primary" size="sm" onClick={onCreate}>
						<PlusIcon className="size-4" />
						{t("rules.createRule")}
					</Button>
				</div>
			</div>
		</div>
	);
}
