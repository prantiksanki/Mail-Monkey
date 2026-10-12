"use client";

import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@repo/ui/components/sheet";
import {
	Clock3Icon,
	InboxIcon,
	MailOpenIcon,
	ShieldCheckIcon,
	SparklesIcon,
	UsersIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

export type StatDrawerKind =
	| "processed"
	| "rulesFired"
	| "timeSaved"
	| "rulesActive"
	| "inboxZero"
	| "priority"
	| "topSenders";

interface BreakdownRow {
	id: string;
	label: string;
	value: number | string;
	numeric: number;
}

interface DashboardStatDrawerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	kind: StatDrawerKind | null;
	title: string;
	subtitle: string;
	rows: BreakdownRow[];
	emptyLabel: string;
}

export function DashboardStatDrawer({
	open,
	onOpenChange,
	kind,
	title,
	subtitle,
	rows,
	emptyLabel,
}: DashboardStatDrawerProps) {
	const t = useTranslations();
	const max = rows.reduce((m, r) => Math.max(m, r.numeric), 0) || 1;
	const Icon =
		kind === "processed"
			? MailOpenIcon
			: kind === "rulesFired"
				? SparklesIcon
				: kind === "timeSaved"
					? Clock3Icon
					: kind === "inboxZero"
						? InboxIcon
						: kind === "topSenders"
							? UsersIcon
							: ShieldCheckIcon;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex flex-col gap-0 bg-card p-0 sm:max-w-lg"
			>
				<SheetHeader className="border-border border-b bg-card p-6 pr-10 text-left">
					<div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
						<Icon className="size-5" />
					</div>
					<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
						{t("dashboard.drawer.eyebrow")}
					</p>
					<SheetTitle className="font-serif font-normal text-[2rem] tracking-[-0.04em]">
						{title}
					</SheetTitle>
					<SheetDescription className="text-sm leading-6">
						{subtitle}
					</SheetDescription>
				</SheetHeader>
				<div className="flex-1 overflow-y-auto p-6">
					{rows.length === 0 ? (
						<div className="flex min-h-[280px] flex-col items-center justify-center text-center">
							<div className="mb-4 flex size-14 items-center justify-center rounded-full bg-muted text-foreground/50">
								<Icon className="size-5" />
							</div>
							<p className="text-sm text-foreground/72">
								{emptyLabel}
							</p>
							<p className="mt-2 max-w-xs text-xs leading-6 text-foreground/48">
								Once activity starts flowing in, this panel will
								break it down into the clearest contributing
								rows.
							</p>
						</div>
					) : (
						<ul className="space-y-3">
							{rows.map((row) => {
								const pct = Math.round(
									(row.numeric / max) * 100,
								);
								return (
									<li
										key={`${kind}-${row.id}`}
										className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-card px-4 py-4"
									>
										<div className="flex items-center justify-between gap-3">
											<span className="truncate text-sm">
												{row.label}
											</span>
											<span className="shrink-0 font-mono text-foreground/60 text-xs">
												{row.value}
											</span>
										</div>
										<div className="h-1 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full bg-primary"
												style={{ width: `${pct}%` }}
											/>
										</div>
									</li>
								);
							})}
						</ul>
					)}
				</div>
			</SheetContent>
		</Sheet>
	);
}
