"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@repo/ui/components/chart";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useSession } from "@saas/auth/hooks/use-session";
import { orpc } from "@shared/lib/orpc-query-utils";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon, EyeIcon, MailIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig: ChartConfig = {
	count: {
		label: "Views",
		color: "hsl(var(--chart-1))",
	},
};

export function ProfileAnalytics() {
	const { user } = useSession();
	const t = useTranslations();

	const accountType = user?.accountType as
		| "STANDARD"
		| "FREELANCER"
		| "CREATOR"
		| undefined;

	const analyticsQuery = useQuery({
		...orpc.creatorProfiles.getProfileAnalytics.queryOptions({
			input: { rangeDays: 30 },
		}),
		enabled: !!accountType && accountType !== "STANDARD",
	});

	if (!accountType || accountType === "STANDARD") {
		return null;
	}

	if (analyticsQuery.isLoading) {
		return <Skeleton className="h-64" />;
	}

	const chartData = (analyticsQuery.data?.dailyViews ?? []).map((d) => ({
		...d,
		label: new Date(d.date).toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
		}),
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("settings.account.analytics.title")}</CardTitle>
				<CardDescription>
					{t("settings.account.analytics.description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="mb-6 grid grid-cols-3 gap-4">
					<div>
						<div className="flex items-center gap-1.5 text-foreground/60 text-xs">
							<EyeIcon className="size-3.5" />
							{t("settings.account.analytics.views")}
						</div>
						<div className="mt-1 font-bold text-2xl">
							{(analyticsQuery.data?.views ?? 0).toLocaleString()}
						</div>
					</div>
					<div>
						<div className="flex items-center gap-1.5 text-foreground/60 text-xs">
							<MailIcon className="size-3.5" />
							{t("settings.account.analytics.contacts")}
						</div>
						<div className="mt-1 font-bold text-2xl">
							{(
								analyticsQuery.data?.contacts ?? 0
							).toLocaleString()}
						</div>
					</div>
					<div>
						<div className="flex items-center gap-1.5 text-foreground/60 text-xs">
							<CalendarIcon className="size-3.5" />
							{t("settings.account.analytics.bookings")}
						</div>
						<div className="mt-1 font-bold text-2xl">
							{(
								analyticsQuery.data?.bookings ?? 0
							).toLocaleString()}
						</div>
					</div>
				</div>

				{chartData.length > 0 && (
					<ChartContainer
						config={chartConfig}
						className="h-40 w-full"
					>
						<AreaChart
							accessibilityLayer
							data={chartData}
							margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
						>
							<defs>
								<linearGradient
									id="fillProfileViews"
									x1="0"
									y1="0"
									x2="0"
									y2="1"
								>
									<stop
										offset="0%"
										stopColor="var(--color-count)"
										stopOpacity={0.4}
									/>
									<stop
										offset="100%"
										stopColor="var(--color-count)"
										stopOpacity={0}
									/>
								</linearGradient>
							</defs>
							<CartesianGrid vertical={false} />
							<XAxis
								dataKey="label"
								tickLine={false}
								axisLine={false}
								tickMargin={8}
								interval="preserveStartEnd"
							/>
							<YAxis
								tickLine={false}
								axisLine={false}
								tickMargin={4}
								allowDecimals={false}
							/>
							<ChartTooltip content={<ChartTooltipContent />} />
							<Area
								dataKey="count"
								type="monotone"
								fill="url(#fillProfileViews)"
								stroke="var(--color-count)"
								strokeWidth={2}
							/>
						</AreaChart>
					</ChartContainer>
				)}
			</CardContent>
		</Card>
	);
}
