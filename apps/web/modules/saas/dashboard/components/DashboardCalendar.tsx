"use client";

import { authClient } from "@repo/auth/client";
import { config as authConfig } from "@repo/auth/config";
import { Button } from "@repo/ui/components/button";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useCalendarEventsQuery } from "@saas/mailboxes/lib/rules-api";
import {
	CalendarDaysIcon,
	CalendarIcon,
	MapPinIcon,
	RefreshCwIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

interface DashboardCalendarProps {
	mailboxId: string | null;
}

export function DashboardCalendar({ mailboxId }: DashboardCalendarProps) {
	const t = useTranslations();
	const format = useFormatter();
	const { data, isLoading } = useCalendarEventsQuery(mailboxId);

	if (isLoading) {
		return (
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-serif font-normal text-[2rem] tracking-[-0.04em]">
						{t("dashboard.calendar.heading")}
					</h2>
				</div>
				<div className="space-y-3 overflow-hidden rounded-2xl border border-border bg-card p-4">
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
					<Skeleton className="h-14 w-full" />
				</div>
			</section>
		);
	}

	if (!data) {
		return null;
	}

	if (data.needsReconnect) {
		const handleReconnect = () => {
			const callbackURL = new URL(
				authConfig.mailboxes.defaultCallbackPath,
				window.location.origin,
			).toString();
			authClient.linkSocial({ provider: "google", callbackURL });
		};

		return (
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-serif font-normal text-[2rem] tracking-[-0.04em]">
						{t("dashboard.calendar.heading")}
					</h2>
				</div>
				<div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/30 p-8 text-center">
					<CalendarIcon className="size-8 text-foreground/40" />
					<div>
						<p className="font-medium text-sm text-foreground">
							{t("dashboard.calendar.reconnect.title")}
						</p>
						<p className="mt-1 text-xs text-foreground/60">
							{t("dashboard.calendar.reconnect.description")}
						</p>
					</div>
					<Button
						size="sm"
						variant="outline"
						onClick={handleReconnect}
						className="gap-2"
					>
						<RefreshCwIcon className="size-3.5" />
						{t("dashboard.calendar.reconnect.cta")}
					</Button>
				</div>
			</section>
		);
	}

	if (data.events.length === 0) {
		return (
			<section>
				<div className="mb-4 flex items-center justify-between">
					<h2 className="font-serif font-normal text-2xl tracking-tight">
						{t("dashboard.calendar.heading")}
					</h2>
				</div>
				<div className="flex min-h-[150px] flex-col items-center justify-center rounded-[26px] border border-border bg-card px-6 py-10 text-center shadow-[0_16px_35px_rgba(15,23,42,0.035)]">
					<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<CalendarDaysIcon className="size-5" />
					</div>
					<p className="text-sm text-foreground/72">
						{t("dashboard.calendar.empty")}
					</p>
					<p className="mt-2 max-w-md text-xs leading-6 text-foreground/48">
						Upcoming calendar events will show here so your inbox
						automations can feel connected to your day.
					</p>
				</div>
			</section>
		);
	}

	return (
		<section>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-serif font-normal text-[2rem] tracking-[-0.04em]">
					{t("dashboard.calendar.heading")}
				</h2>
				<p className="font-mono text-xs uppercase tracking-wider text-foreground/50">
					{t("dashboard.calendar.subheading")}
				</p>
			</div>

			<div className="divide-y divide-border overflow-hidden rounded-[26px] border border-border bg-card shadow-[0_16px_35px_rgba(15,23,42,0.035)]">
				{data.events.map((event) => {
					const startDate = event.start
						? new Date(event.start)
						: null;
					const timeLabel = startDate
						? event.isAllDay
							? format.dateTime(startDate, {
									month: "short",
									day: "numeric",
								})
							: format.dateTime(startDate, {
									month: "short",
									day: "numeric",
									hour: "2-digit",
									minute: "2-digit",
								})
						: null;

					return (
						<div
							key={event.id}
							className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
						>
							<div className="flex min-w-10 flex-col items-center justify-center rounded-lg bg-primary/10 px-2 py-1 text-center">
								{startDate && (
									<>
										<span className="font-mono text-[10px] uppercase tracking-wider text-primary">
											{format.dateTime(startDate, {
												month: "short",
											})}
										</span>
										<span className="font-serif text-xl font-normal leading-none text-primary">
											{format.dateTime(startDate, {
												day: "numeric",
											})}
										</span>
									</>
								)}
							</div>
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-foreground">
									{event.summary ??
										t("dashboard.calendar.noTitle")}
								</p>
								<div className="mt-1 flex items-center gap-3">
									{timeLabel && (
										<span className="font-mono text-xs text-foreground/50">
											{timeLabel}
										</span>
									)}
									{event.location && (
										<span className="flex items-center gap-1 truncate text-xs text-foreground/50">
											<MapPinIcon className="size-3 shrink-0" />
											<span className="truncate">
												{event.location}
											</span>
										</span>
									)}
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</section>
	);
}
