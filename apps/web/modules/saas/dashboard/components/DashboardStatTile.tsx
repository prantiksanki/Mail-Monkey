"use client";

import { cn } from "@repo/ui";
import type { ReactNode } from "react";

interface DashboardStatTileProps {
	title: string;
	value: ReactNode;
	trend?: ReactNode;
	trendTone?: "up" | "down" | "flat";
	sparkline?: number[];
	sparkTone?: "primary" | "muted";
	footer?: ReactNode;
	onClick?: () => void;
}

export function DashboardStatTile({
	title,
	value,
	trend,
	trendTone = "flat",
	sparkline,
	sparkTone = "primary",
	footer,
	onClick,
}: DashboardStatTileProps) {
	const isInteractive = !!onClick;
	const Element = isInteractive ? "button" : "div";

	return (
		<Element
			type={isInteractive ? "button" : undefined}
			onClick={onClick}
			className={cn(
				"group relative flex min-h-[212px] flex-col gap-4 overflow-hidden rounded-[26px] border border-border bg-card p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.03)]",
				isInteractive &&
					"cursor-pointer transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)]",
			)}
		>
			<div
				className={cn(
					"absolute inset-x-5 top-0 h-px origin-left scale-x-100 bg-gradient-to-r from-foreground/35 via-foreground/10 to-transparent",
					isInteractive &&
						"transition-transform duration-200 group-hover:scale-x-[1.03]",
				)}
			/>
			<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
				{title}
			</p>
			<p className="font-serif font-normal text-4xl leading-none tracking-[-0.04em] sm:text-[3.25rem]">
				{value}
			</p>
			<div className="mt-auto space-y-3">
				{trend && (
					<p
						className={cn(
							"text-sm leading-6",
							trendTone === "up" && "text-foreground/68",
							trendTone === "down" && "text-foreground/58",
							trendTone === "flat" && "text-foreground/58",
						)}
					>
						{trend}
					</p>
				)}
				{footer && (
					<div className="text-xs uppercase tracking-[0.18em] text-foreground/42">
						{footer}
					</div>
				)}
				{sparkline && sparkline.length > 1 && (
					<Sparkline data={sparkline} tone={sparkTone} />
				)}
			</div>
		</Element>
	);
}

function Sparkline({
	data,
	tone,
}: {
	data: number[];
	tone: "primary" | "muted";
}) {
	const width = 100;
	const height = 30;
	const max = Math.max(...data, 1);
	const step = data.length > 1 ? width / (data.length - 1) : width;
	const points = data
		.map((v, i) => {
			const x = i * step;
			const y = height - (v / max) * (height - 4) - 2;
			return `${x},${y}`;
		})
		.join(" ");

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			preserveAspectRatio="none"
			aria-hidden="true"
			className="h-9 w-full"
		>
			<polyline
				points={points}
				fill="none"
				stroke={
					tone === "primary"
						? "var(--color-primary)"
						: "var(--color-foreground)"
				}
				strokeOpacity={tone === "primary" ? 0.68 : 0.42}
				strokeWidth={1.7}
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
