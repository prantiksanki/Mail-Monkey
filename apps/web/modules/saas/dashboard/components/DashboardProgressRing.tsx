interface DashboardProgressRingProps {
	percent: number;
	caption: string;
}

/** Hand-rolled SVG ring — mirrors DashboardStatTile's Sparkline in style, no chart library needed for a single static value. */
export function DashboardProgressRing({
	percent,
	caption,
}: DashboardProgressRingProps) {
	const size = 88;
	const strokeWidth = 9;
	const radius = (size - strokeWidth) / 2;
	const circumference = 2 * Math.PI * radius;
	const clamped = Math.max(0, Math.min(100, percent));
	const offset = circumference * (1 - clamped / 100);

	return (
		<div className="flex items-center justify-center py-1">
			<svg
				width={size}
				height={size}
				viewBox={`0 0 ${size} ${size}`}
				role="img"
				aria-label={`${clamped}% ${caption}`}
			>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--color-muted)"
					strokeWidth={strokeWidth}
				/>
				<circle
					cx={size / 2}
					cy={size / 2}
					r={radius}
					fill="none"
					stroke="var(--color-success)"
					strokeWidth={strokeWidth}
					strokeDasharray={circumference}
					strokeDashoffset={offset}
					strokeLinecap="round"
					transform={`rotate(-90 ${size / 2} ${size / 2})`}
				/>
				<text
					x="50%"
					y="50%"
					textAnchor="middle"
					dominantBaseline="middle"
					className="fill-foreground font-[family-name:var(--font-bricolage)] font-semibold text-[24px]"
				>
					{clamped}%
				</text>
			</svg>
		</div>
	);
}
