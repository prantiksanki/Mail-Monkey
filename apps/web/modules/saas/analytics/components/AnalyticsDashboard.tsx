"use client";

import { Card } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { EmailVolumeChart } from "./EmailVolumeChart";
import { OverviewCards } from "./OverviewCards";
import { TopSendersTable } from "./TopSendersTable";

export function AnalyticsDashboard() {
	const t = useTranslations();

	const { data: overview, isLoading: isOverviewLoading } = useQuery(
		orpc.analytics.overview.queryOptions(),
	);

	const { data: topSenders, isLoading: isSendersLoading } = useQuery(
		orpc.analytics.topSenders.queryOptions({ input: { limit: 10 } }),
	);

	const { data: emailVolume, isLoading: isVolumeLoading } = useQuery(
		orpc.analytics.emailVolume.queryOptions({ input: { days: 30 } }),
	);

	const hasData =
		overview &&
		(overview.totalEmailsProcessed > 0 || overview.activeRules.total > 0);

	if (isOverviewLoading) {
		return (
			<div className="space-y-6">
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
					<Skeleton className="h-32" />
				</div>
				<Skeleton className="h-80" />
				<Skeleton className="h-64" />
			</div>
		);
	}

	if (!hasData) {
		return (
			<Card className="p-12">
				<div className="text-center">
					<p className="text-muted-foreground">
						{t("analytics.noData")}
					</p>
				</div>
			</Card>
		);
	}

	return (
		<div className="space-y-6">
			{/* Metric Cards */}
			<OverviewCards
				totalEmails={overview.totalEmailsProcessed}
				successRate={overview.automationSuccessRate}
				activeRules={overview.activeRules}
			/>

			{/* Email Volume Chart */}
			<EmailVolumeChart
				data={emailVolume?.volume ?? []}
				isLoading={isVolumeLoading}
			/>

			{/* Top Senders */}
			<TopSendersTable
				senders={topSenders?.senders ?? []}
				isLoading={isSendersLoading}
			/>
		</div>
	);
}
