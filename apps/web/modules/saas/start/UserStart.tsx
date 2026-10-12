"use client";

import type { MailboxType } from "@repo/database/prisma/zod";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { DashboardAiInsight } from "@saas/dashboard/components/DashboardAiInsight";
import { DashboardHeader } from "@saas/dashboard/components/DashboardHeader";
import { DashboardInboxOverview } from "@saas/dashboard/components/DashboardInboxOverview";
import { DashboardPaymentAlert } from "@saas/dashboard/components/DashboardPaymentAlert";
import { DashboardProgressRing } from "@saas/dashboard/components/DashboardProgressRing";
import {
	DashboardStatDrawer,
	type StatDrawerKind,
} from "@saas/dashboard/components/DashboardStatDrawer";
import { DashboardStatTile } from "@saas/dashboard/components/DashboardStatTile";
import { DashboardTopSenders } from "@saas/dashboard/components/DashboardTopSenders";
import {
	useAllMailboxesDashboardSummaryQuery,
	useDashboardSummaryQuery,
} from "@saas/dashboard/lib/dashboard-api";
import { AddMailboxDialog } from "@saas/mailboxes/components/AddMailboxDialog";
import { MailboxScopeSwitcher } from "@saas/mailboxes/components/MailboxScopeSwitcher";
import { useMailboxesQuery } from "@saas/mailboxes/lib/api";
import { getMailProviderInboxUrl } from "@saas/mailboxes/lib/mail-provider-links";
import {
	useAllMailboxesStatsQuery,
	useAllMailboxesWatchStatusQuery,
	useMailboxStatsQuery,
	useWatchStatusQuery,
} from "@saas/mailboxes/lib/rules-api";
import {
	ALL_MAILBOXES_SCOPE,
	useSelectedMailbox,
} from "@saas/mailboxes/lib/selected-mailbox-context";
import {
	Clock3Icon,
	ExternalLinkIcon,
	MailOpenIcon,
	MailPlusIcon,
	PlusIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

const SECONDS_SAVED_PER_FIRE = 20;

export default function UserStart() {
	const t = useTranslations();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: mailboxes = [], isLoading: mailboxesLoading } =
		useMailboxesQuery();

	const isAllScope = selectedMailboxId === ALL_MAILBOXES_SCOPE;
	const singleMailboxId = isAllScope ? null : selectedMailboxId;
	const allMailboxIds = isAllScope ? mailboxes.map((m) => m.id) : [];

	// Hooks run unconditionally either way — whichever scope isn't active
	// just fetches nothing (guarded by `enabled` / an empty id list).
	const singleStats = useMailboxStatsQuery(singleMailboxId);
	const combinedStats = useAllMailboxesStatsQuery(allMailboxIds);
	const stats = isAllScope ? combinedStats.data : singleStats.data;
	const statsLoading = isAllScope
		? combinedStats.isLoading
		: singleStats.isLoading;

	const singleSummary = useDashboardSummaryQuery(singleMailboxId);
	const combinedSummary = useAllMailboxesDashboardSummaryQuery(allMailboxIds);
	const summary = isAllScope ? combinedSummary.data : singleSummary.data;

	const singleWatch = useWatchStatusQuery(singleMailboxId);
	const combinedWatch = useAllMailboxesWatchStatusQuery(allMailboxIds);
	const isWatching = isAllScope
		? combinedWatch.isWatching
		: (singleWatch.data?.watchEnabled ?? false);

	const [openDrawer, setOpenDrawer] = useState<StatDrawerKind | null>(null);
	const [isAddMailboxOpen, setIsAddMailboxOpen] = useState(false);

	const processedToday = stats?.processedToday ?? 0;
	const processedYesterday = stats?.processedYesterday ?? 0;
	const firedToday = stats?.firedToday ?? 0;

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

	const sparkProcessed = stats?.sparkline7d.map((d) => d.processed) ?? [
		0, 0, 0, 0, 0, 0, 0,
	];

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
			case "topSenders":
				return {
					title: t("dashboard.drawer.topSenders.title"),
					subtitle: t("dashboard.drawer.topSenders.subtitle"),
					emptyLabel: t("dashboard.drawer.topSenders.empty"),
					rows: (summary?.topSenders ?? []).map((s) => ({
						id: s.fromEmail,
						label: s.from || s.fromEmail,
						value: s.count,
						numeric: s.count,
					})),
				};
		}
	}, [openDrawer, stats, totalMinutes, summary, t]);

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

	if (statsLoading && !stats) {
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
			<div className="space-y-3">
				<div className="flex items-center justify-between gap-4">
					<span className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
						Dashboard
					</span>
					<MailboxScopeSwitcher />
				</div>
				{isAllScope && (
					<p className="text-foreground/55 text-xs">
						Showing combined activity across {mailboxes.length}{" "}
						connected mailboxes.
					</p>
				)}
			</div>

			<DashboardHeader
				processedToday={processedToday}
				errorsToday={stats?.errorsToday ?? 0}
				isWatching={isWatching}
			/>

			<DashboardPaymentAlert />

			<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
				<MailboxLinksTile
					mailboxes={mailboxes}
					onAddMailbox={() => setIsAddMailboxOpen(true)}
				/>
				<DashboardStatTile
					title={t("dashboard.stats.inboxZero.title")}
					value={
						<DashboardProgressRing
							percent={summary?.inboxZeroPercent ?? 0}
							caption={t("dashboard.stats.inboxZero.caption")}
						/>
					}
					trend={t("dashboard.stats.inboxZero.onTrack")}
					trendTone="up"
					tone="success"
					onClick={() => setOpenDrawer("inboxZero")}
				/>
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
					tone="purple"
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
					tone="info"
				/>
				<DashboardStatTile
					title={t("dashboard.stats.priority.title")}
					value={summary?.priorityCount ?? 0}
					trend={t("dashboard.stats.priority.needsAttention")}
					trendTone="down"
					footer={
						<div className="inline-flex items-center gap-1.5">
							{t("dashboard.stats.priority.subtitle")}
						</div>
					}
					tone="warning"
				/>
			</div>

			<div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
				<DashboardInboxOverview
					categoryBreakdown={summary?.categoryBreakdown ?? []}
					categorizedTotal={summary?.categorizedTotal ?? 0}
					uncategorizedCount={summary?.uncategorizedCount ?? 0}
				/>
				<DashboardTopSenders
					senders={summary?.topSenders ?? []}
					onViewAll={() => setOpenDrawer("topSenders")}
				/>
			</div>

			<DashboardAiInsight insight={summary?.aiInsight ?? ""} />

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

			<AddMailboxDialog
				open={isAddMailboxOpen}
				onOpenChange={setIsAddMailboxOpen}
				existingMailboxes={mailboxes}
			/>
		</div>
	);
}

function MailboxLinksTile({
	mailboxes,
	onAddMailbox,
}: {
	mailboxes: MailboxType[];
	onAddMailbox: () => void;
}) {
	return (
		<div className="group relative flex min-h-[212px] flex-col gap-4 overflow-hidden rounded-[26px] border border-black/15 bg-card p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.03)] transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-black hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)] dark:border-white/15 dark:hover:border-white">
			<div className="absolute inset-x-5 top-0 h-px origin-left scale-x-100 bg-gradient-to-r from-foreground/35 via-foreground/10 to-transparent transition-transform duration-200 group-hover:scale-x-[1.03]" />
			<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
				Your inboxes
			</p>
			<div className="flex flex-1 flex-col justify-center gap-2 overflow-y-auto">
				{mailboxes.map((mailbox) => {
					const isGoogle = mailbox.provider === "GOOGLE";
					const isImap = mailbox.provider === "IMAP";
					return (
						<a
							key={mailbox.id}
							href={getMailProviderInboxUrl(mailbox)}
							target="_blank"
							rel="noopener noreferrer"
							className="flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90"
						>
							{isImap ? (
								<MailOpenIcon
									className="size-4 shrink-0"
									aria-hidden="true"
								/>
							) : (
								<Image
									src={
										isGoogle
											? "/images/gmail-logo.png"
											: "/images/outlook-logo.png"
									}
									alt=""
									width={16}
									height={16}
									className="size-4 shrink-0 rounded-sm object-contain"
									aria-hidden="true"
								/>
							)}
							<span className="truncate">
								{isImap
									? "Open mail app"
									: isGoogle
										? "Open in Gmail"
										: "Open in Outlook"}
							</span>
							<ExternalLinkIcon className="size-3.5 shrink-0 opacity-80" />
						</a>
					);
				})}
				<button
					type="button"
					onClick={onAddMailbox}
					className="flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm font-medium text-foreground/70 transition-colors hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground"
				>
					<PlusIcon className="size-4 shrink-0" />
					<span className="truncate">Add Gmail or Outlook</span>
				</button>
			</div>
		</div>
	);
}
