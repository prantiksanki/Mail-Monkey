import {
	CheckIcon,
	LayersIcon,
	TargetIcon,
	UsersIcon,
	ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";

interface ResultStat {
	icon: ReactNode;
	label: string;
}

const stats: ResultStat[] = [
	{ icon: <ZapIcon className="size-5" />, label: "Saves time" },
	{ icon: <TargetIcon className="size-5" />, label: "Reduces errors" },
	{ icon: <LayersIcon className="size-5" />, label: "All in one platform" },
	{ icon: <UsersIcon className="size-5" />, label: "Better user experience" },
];

export function ZoomIntegrationResult() {
	return (
		<section className="w-full bg-background px-6 pb-20 sm:px-8 sm:pb-24">
			<div className="mx-auto flex max-w-5xl flex-col items-center gap-6 rounded-[2rem] border border-emerald-500/20 bg-emerald-500/10 p-8 text-center sm:flex-row sm:items-center sm:justify-between sm:p-10 sm:text-left">
				<div className="flex items-start gap-4">
					<span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
						<CheckIcon className="size-5" />
					</span>
					<div>
						<h3 className="mb-1 font-sans text-[20px] font-medium tracking-tight text-foreground">
							Result
						</h3>
						<p className="max-w-md text-[15px] leading-[1.6] text-foreground">
							A smooth, end-to-end experience where users connect
							Zoom once, and every booked meeting automatically
							gets a Zoom link — all within Mail Monkey.
						</p>
					</div>
				</div>

				<div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:flex sm:gap-8">
					{stats.map((stat) => (
						<div
							key={stat.label}
							className="flex flex-col items-center gap-2 sm:items-center"
						>
							<span className="flex size-9 items-center justify-center rounded-full border border-emerald-500/30 bg-background text-emerald-600">
								{stat.icon}
							</span>
							<span className="max-w-[92px] text-[12px] leading-tight text-foreground">
								{stat.label}
							</span>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
