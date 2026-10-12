"use client";

import { type ChartConfig, ChartContainer } from "@repo/ui/components/chart";
import { Cell, Pie, PieChart } from "recharts";

export type DashboardCategoryKey =
	| "PRIMARY"
	| "NEWSLETTER"
	| "PROMOTION"
	| "SOCIAL";

interface DashboardCategoryDonutProps {
	data: Array<{ category: DashboardCategoryKey; count: number }>;
	total: number;
}

const CATEGORY_CONFIG: Record<
	DashboardCategoryKey,
	{ label: string; color: string }
> = {
	PRIMARY: { label: "Primary", color: "var(--category-1)" },
	NEWSLETTER: { label: "Newsletters", color: "var(--category-2)" },
	PROMOTION: { label: "Promotions", color: "var(--category-3)" },
	SOCIAL: { label: "Social", color: "var(--category-4)" },
};

const chartConfig: ChartConfig = {
	count: { label: "Emails" },
	PRIMARY: CATEGORY_CONFIG.PRIMARY,
	NEWSLETTER: CATEGORY_CONFIG.NEWSLETTER,
	PROMOTION: CATEGORY_CONFIG.PROMOTION,
	SOCIAL: CATEGORY_CONFIG.SOCIAL,
};

export function DashboardCategoryDonut({
	data,
	total,
}: DashboardCategoryDonutProps) {
	return (
		<div className="relative flex items-center justify-center">
			<ChartContainer
				config={chartConfig}
				className="mx-auto h-[150px] w-[150px]"
			>
				<PieChart>
					<Pie
						data={data}
						dataKey="count"
						nameKey="category"
						innerRadius={45}
						outerRadius={68}
						strokeWidth={2}
					>
						{data.map((entry) => (
							<Cell
								key={entry.category}
								fill={CATEGORY_CONFIG[entry.category].color}
							/>
						))}
					</Pie>
				</PieChart>
			</ChartContainer>
			<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
				<span className="font-[family-name:var(--font-bricolage)] font-semibold text-2xl leading-none tracking-tight">
					{total}
				</span>
				<span className="mt-1 text-[10px] text-foreground/50 uppercase tracking-wider">
					Total
				</span>
			</div>
		</div>
	);
}

export { CATEGORY_CONFIG };
