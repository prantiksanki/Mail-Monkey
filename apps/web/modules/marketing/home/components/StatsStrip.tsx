import { cn } from "@repo/ui";

const stats = [
	{ n: "2-3 hrs", l: "saved per day" },
	{ n: "$120-150", l: "saved vs alternatives / mo" },
	{ n: "50k+", l: "emails processed daily" },
];

export function StatsStrip() {
	return (
		<div className="bg-background">
			<div className="grid grid-cols-2 border-t border-border md:grid-cols-3">
				{stats.map((stat, index) => (
					<div
						key={stat.l}
						className={cn(
							"px-4 py-7 text-center",
							index < stats.length - 1 &&
								"border-r border-border",
							index < 2 && "border-b border-border md:border-b-0",
						)}
					>
						<div className="font-sans text-[30px] font-normal tracking-tight text-foreground">
							{stat.n}
						</div>
						<div className="mt-[6px] font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
							{stat.l}
						</div>
					</div>
				))}
			</div>
			<p className="border-t border-border px-6 py-3 text-center font-mono text-[10px] text-muted-foreground">
				Based on aggregate usage data from active Pro/Premium users, Q1
				2026.
			</p>
		</div>
	);
}
