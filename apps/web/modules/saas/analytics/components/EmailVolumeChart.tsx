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
import { useTranslations } from "next-intl";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface EmailVolumeChartProps {
	data: Array<{
		date: string;
		total: number;
		matched: number;
		errors: number;
	}>;
	isLoading: boolean;
}

const chartConfig: ChartConfig = {
	total: {
		label: "Total",
		color: "hsl(var(--chart-1))",
	},
	matched: {
		label: "Matched",
		color: "hsl(var(--chart-2))",
	},
	errors: {
		label: "Errors",
		color: "hsl(var(--chart-5))",
	},
};

export function EmailVolumeChart({ data, isLoading }: EmailVolumeChartProps) {
	const t = useTranslations();

	if (isLoading) {
		return <Skeleton className="h-80" />;
	}

	// Format date labels: "Mar 5"
	const chartData = data.map((d) => {
		const date = new Date(d.date);
		return {
			...d,
			label: date.toLocaleDateString("en-US", {
				month: "short",
				day: "numeric",
			}),
		};
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("analytics.emailVolume")}</CardTitle>
				<CardDescription>
					{t("analytics.emailVolumeDescription")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<ChartContainer config={chartConfig} className="h-64 w-full">
					<AreaChart
						accessibilityLayer
						data={chartData}
						margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
					>
						<defs>
							<linearGradient
								id="fillTotal"
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
								<stop
									offset="0%"
									stopColor="var(--color-total)"
									stopOpacity={0.4}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-total)"
									stopOpacity={0}
								/>
							</linearGradient>
							<linearGradient
								id="fillMatched"
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
								<stop
									offset="0%"
									stopColor="var(--color-matched)"
									stopOpacity={0.3}
								/>
								<stop
									offset="100%"
									stopColor="var(--color-matched)"
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
							dataKey="total"
							type="monotone"
							fill="url(#fillTotal)"
							stroke="var(--color-total)"
							strokeWidth={2}
						/>
						<Area
							dataKey="matched"
							type="monotone"
							fill="url(#fillMatched)"
							stroke="var(--color-matched)"
							strokeWidth={2}
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
