import { cn } from "@repo/ui";

const stats = [
	{ n: "2-3 hrs", l: "saved per day" },
	{ n: "$120-150", l: "saved vs alternatives / mo" },
	{ n: "$9/mo", l: "our pricing" },
	{ n: "50k+", l: "emails processed daily" },
];

export function StatsStrip() {
	return (
		<div className="bg-black">
			<div className="grid grid-cols-2 border-t border-white/10 md:grid-cols-4">
				{stats.map((stat, index) => (
					<div
						key={stat.l}
						className={cn(
							"px-4 py-7 text-center",
							index < stats.length - 1 &&
								"border-r border-white/10",
							index < 2 &&
								"border-b border-white/10 md:border-b-0",
						)}
					>
						<div className="font-serif text-[30px] font-normal tracking-tight text-white">
							{stat.n}
						</div>
						<div className="mt-[6px] font-mono text-[11px] uppercase tracking-[0.2em] text-white/45">
							{stat.l}
						</div>
					</div>
				))}
			</div>
			<p className="border-t border-white/10 px-6 py-3 text-center font-mono text-[10px] text-white/25">
				Based on aggregate usage data from active Pro/Premium users, Q1
				2026.
			</p>
		</div>
	);
}
