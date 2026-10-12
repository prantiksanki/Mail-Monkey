"use client";

import { cn } from "@repo/ui";
import type { ReactNode } from "react";

const TILE_TONE_BG = {
	success: "bg-success-soft dark:bg-card",
	purple: "bg-stat-purple-soft dark:bg-card",
	info: "bg-info-soft dark:bg-card",
	warning: "bg-warning-soft dark:bg-card",
} as const;

// Light mode: darker tint of the accent for a subtle stroke on a pastel fill.
// Dark mode: the fill collapses to plain `bg-card`, so the border switches to
// the theme's bright dark-mode accent token instead — the darker light-mode
// hex would be nearly invisible against the near-black card background.
const TILE_TONE_BORDER = {
	success:
		"border-[#0D6020]/30 hover:border-[#0D6020] dark:border-success/50 dark:hover:border-success",
	purple: "border-[#3E0A69]/30 hover:border-[#3E0A69] dark:border-stat-purple/50 dark:hover:border-stat-purple",
	info: "border-[#103A7F]/30 hover:border-[#103A7F] dark:border-info/50 dark:hover:border-info",
	warning:
		"border-[#73470D]/30 hover:border-[#73470D] dark:border-warning/50 dark:hover:border-warning",
} as const;

interface DashboardStatTileProps {
	title: string;
	value: ReactNode;
	trend?: ReactNode;
	trendTone?: "up" | "down" | "flat";
	sparkline?: number[];
	sparkTone?: "primary" | "muted";
	footer?: ReactNode;
	onClick?: () => void;
	tone?: keyof typeof TILE_TONE_BG;
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
	tone,
}: DashboardStatTileProps) {
	const isInteractive = !!onClick;
	const Element = isInteractive ? "button" : "div";

	return (
		<Element
			type={isInteractive ? "button" : undefined}
			onClick={onClick}
			className={cn(
				"group relative flex min-h-[212px] flex-col gap-4 overflow-hidden rounded-[26px] border p-5 text-left shadow-[0_18px_40px_rgba(15,23,42,0.03)] transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(15,23,42,0.07)]",
				tone ? TILE_TONE_BG[tone] : "bg-card",
				tone
					? TILE_TONE_BORDER[tone]
					: "border-border hover:border-primary/60",
				isInteractive && "cursor-pointer",
			)}
		>
			<div
				className={cn(
					"absolute inset-x-5 top-0 h-px origin-left scale-x-100 bg-gradient-to-r from-foreground/35 via-foreground/10 to-transparent transition-transform duration-200 group-hover:scale-x-[1.03]",
				)}
			/>
			<p className="font-mono text-[11px] text-foreground/45 uppercase tracking-[0.24em]">
				{title}
			</p>
			<p className="font-[family-name:var(--font-bricolage)] font-semibold text-4xl leading-none tracking-[-0.04em] sm:text-[3.25rem]">
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
