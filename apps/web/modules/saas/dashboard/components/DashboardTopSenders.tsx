"use client";

import { UserAvatar } from "@shared/components/UserAvatar";
import { UsersIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface DashboardTopSendersProps {
	senders: Array<{ fromEmail: string; from: string; count: number }>;
	onViewAll?: () => void;
}

export function DashboardTopSenders({
	senders,
	onViewAll,
}: DashboardTopSendersProps) {
	const t = useTranslations();

	return (
		<div className="flex flex-col gap-2 rounded-[26px] border border-border bg-card p-5 shadow-[0_18px_40px_rgba(15,23,42,0.03)]">
			<div className="mb-2 flex items-center justify-between">
				<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
					{t("dashboard.topSenders.title")}
				</p>
				{onViewAll && senders.length > 0 && (
					<button
						type="button"
						onClick={onViewAll}
						className="text-primary text-xs font-medium hover:underline"
					>
						{t("dashboard.topSenders.viewAll")}
					</button>
				)}
			</div>

			{senders.length === 0 ? (
				<div className="flex min-h-[150px] flex-col items-center justify-center text-center">
					<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
						<UsersIcon className="size-5" />
					</div>
					<p className="text-sm text-foreground/72">
						{t("dashboard.topSenders.empty")}
					</p>
				</div>
			) : (
				<div className="flex flex-col">
					{senders.map((sender, i) => (
						<div
							key={sender.fromEmail}
							className={
								i < senders.length - 1
									? "flex items-center gap-3 border-border/60 border-b py-3"
									: "flex items-center gap-3 py-3"
							}
						>
							<UserAvatar
								name={sender.from || sender.fromEmail}
								className="size-9 shrink-0 text-xs"
							/>
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">
									{sender.from || sender.fromEmail}
								</p>
								<p className="truncate text-foreground/48 text-xs">
									{sender.fromEmail}
								</p>
							</div>
							<span className="shrink-0 font-medium text-foreground/72 text-sm tabular-nums">
								{sender.count}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
