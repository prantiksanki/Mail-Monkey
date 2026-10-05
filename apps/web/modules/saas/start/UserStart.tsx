"use client";

import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { DashboardActivity } from "@saas/dashboard/components/DashboardActivity";
import { DashboardCalendar } from "@saas/dashboard/components/DashboardCalendar";
import { DashboardHeader } from "@saas/dashboard/components/DashboardHeader";
import {
	DashboardStatDrawer,
	type StatDrawerKind,
} from "@saas/dashboard/components/DashboardStatDrawer";
import { DashboardStatTile } from "@saas/dashboard/components/DashboardStatTile";
import { DashboardTopRules } from "@saas/dashboard/components/DashboardTopRules";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { useMailboxStatsQuery } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	Clock3Icon,
	MailOpenIcon,
	MailPlusIcon,
	ShieldCheckIcon,
	SparklesIcon,
} from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

const SECONDS_SAVED_PER_FIRE = 20;

export default function UserStart() {
	const t = useTranslations();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [], isLoading: mailboxesLoading } =
		useMailboxesQuery();
	const { data: stats, isLoading: statsLoading } =
		useMailboxStatsQuery(selectedMailboxId);
	const [openDrawer, setOpenDrawer] = useState<StatDrawerKind | null>(null);
	const [mounted, setMounted] = useState(false);

	useEffect(() => setMounted(true), []);

	const processedToday = stats?.processedToday ?? 0;
	const processedYesterday = stats?.processedYesterday ?? 0;
	const firedToday = stats?.firedToday ?? 0;
	const firedYesterday = stats?.firedYesterday ?? 0;
	const rulesActive = stats?.rulesActive ?? 0;
	const rulesTotal = stats?.rulesTotal ?? 0;
	const disabled = Math.max(rulesTotal - rulesActive, 0);

	const totalSeconds = firedToday * SECONDS_SAVED_PER_FIRE;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const timeSavedLabel =
		totalMinutes >= 60
			? t("dashboard.stats.timeSaved.value", {
					hours: Math.floor(totalMinutes / 60),
					minutes: totalMinutes % 60,
				})
			: totalMinutes >= 1
				? t("dashboard.stats.timeSaved.valueShort", {
						minutes: totalMinutes,
					})
				: // Under a minute: show seconds so any rule fire registers
					// instead of flooring to "0m".
					t("dashboard.stats.timeSaved.valueSeconds", {
						seconds: totalSeconds,
					});

	const processedDeltaPct =
		processedYesterday > 0
			? Math.round(
					((processedToday - processedYesterday) /
						processedYesterday) *
						100,
				)
			: null;
	const processedTrend = (() => {
		if (processedDeltaPct === null) {
			return {
				text: t("dashboard.stats.processed.trendFlat"),
				tone: "flat" as const,
			};
		}
		if (processedDeltaPct > 0) {
			return {
				text: t("dashboard.stats.processed.trendUp", {
					percent: processedDeltaPct,
				}),
				tone: "up" as const,
			};
		}
		if (processedDeltaPct < 0) {
			return {
				text: t("dashboard.stats.processed.trendDown", {
					percent: Math.abs(processedDeltaPct),
				}),
				tone: "down" as const,
			};
		}
		return {
			text: t("dashboard.stats.processed.trendFlat"),
			tone: "flat" as const,
		};
	})();

	const firedDelta = firedToday - firedYesterday;
	const firedTrend =
		firedDelta > 0
			? {
					text: t("dashboard.stats.rulesFired.trendUp", {
						delta: firedDelta,
					}),
					tone: "up" as const,
				}
			: firedDelta < 0
				? {
						text: t("dashboard.stats.rulesFired.trendDown", {
							delta: Math.abs(firedDelta),
						}),
						tone: "down" as const,
					}
				: {
						text: t("dashboard.stats.rulesFired.trendFlat"),
						tone: "flat" as const,
					};

	const sparkProcessed = stats?.sparkline7d.map((d) => d.processed) ?? [
		0, 0, 0, 0, 0, 0, 0,
	];
	const sparkFired = stats?.sparkline7d.map((d) => d.fired) ?? [
		0, 0, 0, 0, 0, 0, 0,
	];
	const sparkRulesActive = Array.from({ length: 7 }, () => rulesActive);

	const drawerProps = useMemo(() => {
		if (!openDrawer || !stats) {
			return null;
		}
		switch (openDrawer) {
			case "processed":
				return {
					title: t("dashboard.drawer.processed.title", {
						count: stats.breakdownByRule24h.reduce(
							(sum, r) => sum + r.count,
							0,
						),
					}),
					subtitle: t("dashboard.drawer.processed.subtitle"),
					emptyLabel: t("dashboard.drawer.processed.empty"),
					rows: stats.breakdownByRule24h.map((r) => ({
						id: r.id,
						label: r.name,
						value: r.count,
						numeric: r.count,
					})),
				};
			case "rulesFired":
				return {
					title: t("dashboard.drawer.rulesFired.title", {
						count: firedToday,
					}),
					subtitle: t("dashboard.drawer.rulesFired.subtitle"),
					emptyLabel: t("dashboard.drawer.rulesFired.empty"),
					rows: stats.breakdownByRule24h.map((r) => ({
						id: r.id,
						label: r.name,
						value: r.count,
						numeric: r.count,
					})),
				};
			case "timeSaved":
				return {
					title: t("dashboard.drawer.timeSaved.title", {
						minutes: totalMinutes,
					}),
					subtitle: t("dashboard.drawer.timeSaved.subtitle"),
					emptyLabel: t("dashboard.drawer.timeSaved.empty"),
					rows: stats.actionsBreakdown24h.map((a) => {
						const mins = Math.max(
							Math.round((a.count * SECONDS_SAVED_PER_FIRE) / 60),
							0,
						);
						return {
							id: a.type,
							label: t(
								`rules.ruleForm.actionTypes.${a.type}` as const,
							),
							value:
								mins > 0
									? t(
											"dashboard.stats.timeSaved.valueShort",
											{
												minutes: mins,
											},
										)
									: `${a.count}×`,
							numeric: a.count,
						};
					}),
				};
			case "rulesActive":
				return {
					title: t("dashboard.drawer.rulesActive.title", {
						active: rulesActive,
						total: rulesTotal,
					}),
					subtitle: t("dashboard.drawer.rulesActive.subtitle"),
					emptyLabel: t("dashboard.drawer.rulesActive.empty"),
					rows: stats.rulesList.map((r) => ({
						id: r.id,
						label: r.enabled
							? r.name
							: t("dashboard.drawer.rulesActive.disabledLabel", {
									name: r.name,
								}),
						value: t("dashboard.topRules.fires", {
							count: r.count,
						}),
						numeric: r.count,
					})),
				};
		}
	}, [
		openDrawer,
		stats,
		firedToday,
		totalMinutes,
		rulesActive,
		rulesTotal,
		t,
	]);

	if (!mailboxesLoading && mailboxes.length === 0) {
		return (
			<div className="mx-auto max-w-xl rounded-[28px] border border-dashed border-border/70 bg-muted/30 p-10 text-center">
				<div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-background">
					<MailPlusIcon className="size-6 text-foreground/60" />
				</div>
				<h2 className="font-serif font-normal text-2xl tracking-tight">
					{t("dashboard.emptyMailbox.title")}
				</h2>
				<p className="mt-2 text-foreground/60 text-sm">
					{t("dashboard.emptyMailbox.description")}
				</p>
				<Button asChild className="mt-5">
					<Link href="/app/mailboxes">
						{t("dashboard.emptyMailbox.cta")}
					</Link>
				</Button>
			</div>
		);
	}

	if (!mounted || (statsLoading && !stats)) {
		return (
			<div className="space-y-8">
				<Skeleton className="h-24 w-full" />
				<div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
					<Skeleton className="h-40 w-full" />
				</div>
				<Skeleton className="h-72 w-full" />
			</div>
		);
	}

	return (
		<div className="mx-auto max-w-[1580px] space-y-10">
			<DashboardHeader
				processedToday={processedToday}
				errorsToday={stats?.errorsToday ?? 0}
			/>

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<DashboardStatTile
					title={t("dashboard.stats.processed.title")}
					value={processedToday}
					trend={processedTrend.text}
					trendTone={processedTrend.tone}
					sparkline={sparkProcessed}
					footer={
						<div className="inline-flex items-center gap-1.5">
							<MailOpenIcon className="size-3.5" />
							Last 7 days
						</div>
					}
					onClick={() => setOpenDrawer("processed")}
				/>
				<DashboardStatTile
					title={t("dashboard.stats.rulesFired.title")}
					value={firedToday}
					trend={firedTrend.text}
					trendTone={firedTrend.tone}
					sparkline={sparkFired}
					footer={
						<div className="inline-flex items-center gap-1.5">
							<SparklesIcon className="size-3.5" />
							Automation cadence
						</div>
					}
					onClick={() => setOpenDrawer("rulesFired")}
				/>
				<DashboardStatTile
					title={t("dashboard.stats.timeSaved.title")}
					value={timeSavedLabel}
					trend={t("dashboard.stats.timeSaved.trend")}
					trendTone="up"
					footer={
						<div className="inline-flex items-center gap-1.5">
							<Clock3Icon className="size-3.5" />
							Estimated impact
						</div>
					}
					onClick={() => setOpenDrawer("timeSaved")}
				/>
				<DashboardStatTile
					title={t("dashboard.stats.rulesActive.title")}
					value={t("dashboard.stats.rulesActive.value", {
						active: rulesActive,
						total: rulesTotal,
					})}
					trend={t("dashboard.stats.rulesActive.trend", {
						disabled,
					})}
					trendTone="flat"
					sparkline={sparkRulesActive}
					sparkTone="muted"
					footer={
						<div className="inline-flex items-center gap-1.5">
							<ShieldCheckIcon className="size-3.5" />
							Coverage snapshot
						</div>
					}
					onClick={() => setOpenDrawer("rulesActive")}
				/>
			</div>

			<DashboardActivity mailboxId={selectedMailboxId} />

			<DashboardCalendar mailboxId={selectedMailboxId} />

			<DashboardTopRules rules={stats?.topRules7d ?? []} />

			<DashboardStatDrawer
				open={!!openDrawer}
				onOpenChange={(open) => {
					if (!open) {
						setOpenDrawer(null);
					}
				}}
				kind={openDrawer}
				title={drawerProps?.title ?? ""}
				subtitle={drawerProps?.subtitle ?? ""}
				rows={drawerProps?.rows ?? []}
				emptyLabel={drawerProps?.emptyLabel ?? ""}
			/>
		</div>
	);
}
