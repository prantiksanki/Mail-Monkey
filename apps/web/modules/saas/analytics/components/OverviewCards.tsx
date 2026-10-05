"use client";

import { Badge } from "@repo/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import { ActivityIcon, CheckCircleIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface OverviewCardsProps {
	totalEmails: number;
	successRate: {
		rate: number;
		matched: number;
		errors: number;
		total: number;
	};
	activeRules: {
		active: number;
		total: number;
	};
}

export function OverviewCards({
	totalEmails,
	successRate,
	activeRules,
}: OverviewCardsProps) {
	const t = useTranslations();

	const formattedRate =
		successRate.total > 0 ? `${Math.round(successRate.rate * 100)}%` : "—";

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{/* Total Emails Processed */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-foreground/60 text-sm font-medium">
						{t("analytics.totalEmailsProcessed")}
					</CardTitle>
					<MailIcon className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="font-bold text-2xl">
						{totalEmails.toLocaleString()}
					</div>
					<p className="mt-1 text-muted-foreground text-xs">
						{t("analytics.emails")}
					</p>
				</CardContent>
			</Card>

			{/* Automation Success Rate */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-foreground/60 text-sm font-medium">
						{t("analytics.automationSuccessRate")}
					</CardTitle>
					<CheckCircleIcon className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2">
						<span className="font-bold text-2xl">
							{formattedRate}
						</span>
						{successRate.total > 0 && (
							<Badge
								status={
									successRate.rate >= 0.9
										? "success"
										: successRate.rate >= 0.7
											? "info"
											: "error"
								}
							>
								{successRate.matched} / {successRate.total}
							</Badge>
						)}
					</div>
					{successRate.errors > 0 && (
						<p className="mt-1 text-destructive text-xs">
							{successRate.errors} {t("analytics.errors")}
						</p>
					)}
				</CardContent>
			</Card>

			{/* Active Rules */}
			<Card>
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-foreground/60 text-sm font-medium">
						{t("analytics.activeRules")}
					</CardTitle>
					<ActivityIcon className="h-4 w-4 text-muted-foreground" />
				</CardHeader>
				<CardContent>
					<div className="flex items-center gap-2">
						<span className="font-bold text-2xl">
							{activeRules.active}
						</span>
						<span className="text-muted-foreground text-sm">
							{t("analytics.activeRulesContext", {
								total: activeRules.total,
							})}
						</span>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
