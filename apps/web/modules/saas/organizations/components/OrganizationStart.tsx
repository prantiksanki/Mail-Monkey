"use client";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@repo/ui/components/card";
import type { ChartConfig } from "@repo/ui/components/chart";
import { RuleAssistantChat } from "@saas/start/components/RuleAssistantChat";
import { StatsTile } from "@saas/start/components/StatsTile";
import { StatsTileChart } from "@saas/start/components/StatsTileChart";

const clientsData = [
	{ month: "Jan", clients: 289 },
	{ month: "Feb", clients: 275 },
	{ month: "Mar", clients: 332 },
	{ month: "Apr", clients: 347 },
	{ month: "May", clients: 344 },
];

const revenueData = [
	{ month: "Jan", revenue: 4200 },
	{ month: "Feb", revenue: 3800 },
	{ month: "Mar", revenue: 5100 },
	{ month: "Apr", revenue: 4900 },
	{ month: "May", revenue: 5243 },
];

const churnData = [
	{ month: "Jan", churn: 0.045 },
	{ month: "Feb", churn: 0.038 },
	{ month: "Mar", churn: 0.032 },
	{ month: "Apr", churn: 0.028 },
	{ month: "May", churn: 0.03 },
];

const clientsChartConfig = {
	clients: {
		label: "Clients",
		color: "hsl(var(--chart-1))",
	},
} satisfies ChartConfig;

const revenueChartConfig = {
	revenue: {
		label: "Revenue",
		color: "hsl(var(--chart-2))",
	},
} satisfies ChartConfig;

const churnChartConfig = {
	churn: {
		label: "Churn",
		color: "hsl(var(--chart-3))",
	},
} satisfies ChartConfig;

export default function OrganizationStart() {
	return (
		<div className="@container">
			<div className="grid @2xl:grid-cols-3 gap-4">
				<StatsTile
					title="New clients"
					value={344}
					valueFormat="number"
					trend={0.12}
				>
					<StatsTileChart
						data={clientsData}
						dataKey="clients"
						chartConfig={clientsChartConfig}
						gradientId="gradientClients"
						tooltipFormatter={(value) =>
							Intl.NumberFormat("us").format(Number(value))
						}
					/>
				</StatsTile>
				<StatsTile
					title="Revenue"
					value={5243}
					valueFormat="currency"
					trend={0.6}
				>
					<StatsTileChart
						data={revenueData}
						dataKey="revenue"
						chartConfig={revenueChartConfig}
						gradientId="gradientRevenue"
						tooltipFormatter={(value) =>
							`$${Intl.NumberFormat("us").format(Number(value))}`
						}
					/>
				</StatsTile>
				<StatsTile
					title="Churn"
					value={0.03}
					valueFormat="percentage"
					trend={-0.3}
				>
					<StatsTileChart
						data={churnData}
						dataKey="churn"
						chartConfig={churnChartConfig}
						gradientId="gradientChurn"
						tooltipFormatter={(value) =>
							`${(Number(value) * 100).toFixed(1)}%`
						}
					/>
				</StatsTile>
			</div>

			<Card className="mt-6">
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Rule Assistant</CardTitle>
				</CardHeader>
				<CardContent>
					<RuleAssistantChat />
				</CardContent>
			</Card>
		</div>
	);
}
