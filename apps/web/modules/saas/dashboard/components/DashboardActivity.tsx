"use client";

import { Badge } from "@repo/ui/components/badge";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useExecutionLogsQuery } from "@saas/mailboxes/lib/rules-api";
import { InboxIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

interface DashboardActivityProps {
	mailboxId: string | null;
}

type ActionEntry = { type?: string; success?: boolean };

function parseFromDisplayName(raw: string | null | undefined): string {
	if (!raw) {
		return "";
	}
	const match = raw.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
	if (match) {
		return match[1].trim();
	}
	const emailOnly = raw.match(/^\s*<?([^<>\s]+@[^<>\s]+)>?\s*$/);
	if (emailOnly) {
		return emailOnly[1];
	}
	return raw.trim();
}

export function DashboardActivity({ mailboxId }: DashboardActivityProps) {
	const t = useTranslations();
	const format = useFormatter();
	const { data, isLoading } = useExecutionLogsQuery(mailboxId, 7, 0, {
		status: "matched",
	});

	return (
		<section>
			<div className="mb-4 flex items-center justify-between">
				<h2 className="font-serif font-normal text-[2rem] tracking-[-0.04em]">
					{t("dashboard.activity.heading")}
				</h2>
			</div>

			<div className="overflow-hidden rounded-[26px] border border-border bg-card shadow-[0_16px_35px_rgba(15,23,42,0.035)]">
				{isLoading ? (
					<div className="space-y-px p-4">
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
						<Skeleton className="h-10 w-full" />
					</div>
				) : !data?.logs.length ? (
					<div className="flex min-h-[150px] flex-col items-center justify-center px-6 py-10 text-center">
						<div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<InboxIcon className="size-5" />
						</div>
						<p className="text-sm text-foreground/72">
							{t("dashboard.activity.empty")}
						</p>
						<p className="mt-2 max-w-md text-xs leading-6 text-foreground/48">
							Matched rule activity will appear here with
							timestamps, actions, and affected messages.
						</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full table-fixed text-sm">
							<colgroup>
								<col className="w-[96px]" />
								<col className="w-[200px]" />
								<col />
								<col className="w-[180px]" />
							</colgroup>
							<thead>
								<tr className="border-border border-b text-left font-mono text-foreground/50 text-xs uppercase tracking-wider">
									<th className="px-5 py-3 font-normal">
										{t("dashboard.activity.columns.time")}
									</th>
									<th className="px-5 py-3 font-normal">
										{t("dashboard.activity.columns.rule")}
									</th>
									<th className="px-5 py-3 font-normal">
										{t("dashboard.activity.columns.email")}
									</th>
									<th className="px-5 py-3 font-normal">
										{t("dashboard.activity.columns.action")}
									</th>
								</tr>
							</thead>
							<tbody>
								{data.logs.map((log) => {
									const actions = Array.isArray(
										log.actionsRun,
									)
										? (log.actionsRun as ActionEntry[])
										: [];
									const time = format.dateTime(
										new Date(log.createdAt),
										{
											hour: "2-digit",
											minute: "2-digit",
										},
									);
									const fromName = parseFromDisplayName(
										log.from,
									);
									const primaryAction = actions.find(
										(a) => a.type && a.success !== false,
									);
									const extraActionCount =
										actions.filter(
											(a) =>
												a.type && a.success !== false,
										).length - (primaryAction ? 1 : 0);
									return (
										<tr
											key={log.id}
											className="border-border border-b last:border-b-0 transition-colors hover:bg-muted/40"
										>
											<td className="px-5 py-3 font-mono text-foreground/60 text-xs">
												{time}
											</td>
											<td className="truncate px-5 py-3 text-foreground">
												{log.rule?.name ?? "—"}
											</td>
											<td className="px-5 py-3">
												<p className="truncate text-foreground">
													{log.subject ||
														fromName ||
														"—"}
												</p>
												{log.subject && fromName && (
													<p className="truncate text-foreground/50 text-xs">
														{fromName}
													</p>
												)}
											</td>
											<td className="px-5 py-3">
												<div className="flex items-center gap-1.5">
													{log.status === "error" ? (
														<Badge status="error">
															{t(
																"dashboard.activity.statusError",
															)}
														</Badge>
													) : log.status ===
															"not_matched" ||
														!primaryAction ? (
														<Badge>
															{t(
																"dashboard.activity.statusNotMatched",
															)}
														</Badge>
													) : (
														<>
															<Badge status="info">
																{t(
																	`rules.ruleForm.actionTypes.${primaryAction.type}`,
																)}
															</Badge>
															{extraActionCount >
																0 && (
																<span className="font-mono text-foreground/50 text-xs">
																	+
																	{
																		extraActionCount
																	}
																</span>
															)}
														</>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</section>
	);
}
