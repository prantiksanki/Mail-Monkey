"use client";

import { cn } from "@repo/ui";
import { useSession } from "@saas/auth/hooks/use-session";
import { useWatchStatusQuery } from "@saas/mailboxes/lib/rules-api";
import { useSelectedMailbox } from "@saas/mailboxes/lib/selected-mailbox-context";
import { useFormatter, useNow, useTranslations } from "next-intl";

interface DashboardHeaderProps {
	processedToday: number;
	errorsToday: number;
}

export function DashboardHeader({
	processedToday,
	errorsToday,
}: DashboardHeaderProps) {
	const t = useTranslations();
	const format = useFormatter();
	const now = useNow();
	const { user } = useSession();
	const { selectedMailboxId } = useSelectedMailbox();
	const { data: watchStatus } = useWatchStatusQuery(selectedMailboxId);

	const hour = now.getHours();
	const partOfDay =
		hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
	const firstName = (user?.name ?? "").split(" ")[0] || user?.name || "";

	const dateLabel = format.dateTime(now, {
		weekday: "long",
		month: "long",
		day: "numeric",
	});

	const isWatching = watchStatus?.watchEnabled ?? false;

	return (
		<div className="grid gap-4 pb-4 xl:grid-cols-[minmax(0,1.5fr)_320px]">
			<div className="min-w-0 rounded-[28px] border border-border bg-card px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.04)] sm:px-8 sm:py-7">
				<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.28em]">
					{t(`dashboard.greeting.${partOfDay}`, { name: firstName })}
				</p>
				<h1 className="mt-3 text-balance font-serif font-normal text-4xl leading-[0.98] tracking-[-0.04em] md:text-6xl">
					{dateLabel}
				</h1>
				<p className="mt-4 max-w-2xl text-[15px] text-foreground/62 leading-7">
					{t("dashboard.subtitle", {
						count: processedToday,
						attention: errorsToday,
					})}
				</p>
			</div>

			<div className="flex flex-col justify-between rounded-[28px] border border-border bg-card px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.03)]">
				<span
					className={cn(
						"inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.24em]",
						isWatching
							? "border-primary/30 bg-primary-soft text-primary-deep"
							: "border-border bg-muted text-foreground/50",
					)}
				>
					<span
						className={cn(
							"size-1.5 rounded-full",
							isWatching ? "bg-primary" : "bg-foreground/40",
						)}
					/>
					{isWatching
						? t("dashboard.watching")
						: t("dashboard.notWatching")}
				</span>

				<div className="mt-8 grid gap-5">
					<div>
						<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
							Today&apos;s rhythm
						</p>
						<p className="mt-2 font-serif text-3xl leading-none tracking-tight">
							{processedToday}
						</p>
						<p className="mt-2 text-sm text-foreground/58">
							Emails touched across your active automations today.
						</p>
					</div>

					<div className="grid grid-cols-2 gap-3 border-border border-t pt-4">
						<div>
							<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.22em]">
								Attention
							</p>
							<p className="mt-1 text-lg text-foreground/82">
								{errorsToday}
							</p>
						</div>
						<div>
							<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.22em]">
								Status
							</p>
							<p className="mt-1 text-lg text-foreground/82">
								{isWatching ? "Live" : "Idle"}
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
