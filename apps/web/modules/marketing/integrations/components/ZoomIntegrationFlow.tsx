import { cn } from "@repo/ui";

interface FlowStep {
	title: string;
	description: string;
}

const steps: FlowStep[] = [
	{
		title: "Authorise Zoom",
		description:
			"One OAuth screen from your MailMonkey settings. Takes about fifteen seconds.",
	},
	{
		title: "Pick the event types",
		description:
			"Choose which booking types default to Zoom. Everything else stays as it is.",
	},
	{
		title: "Forget about it",
		description:
			"Links, reminders and updates run themselves from the first booking onwards.",
	},
];

export function ZoomIntegrationFlow() {
	return (
		<section
			id="how-it-works"
			className="w-full scroll-mt-24 bg-background px-6 py-20 sm:px-8 sm:py-24"
		>
			<div className="mx-auto w-full max-w-6xl">
				<span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
					How it works
				</span>
				<h2 className="mt-3 font-sans text-[32px] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[40px]">
					Three steps, then never again.
				</h2>

				<div className="mt-14 grid grid-cols-1 overflow-hidden rounded-2xl border border-border sm:grid-cols-3">
					{steps.map((step, index) => (
						<div
							key={step.title}
							className={cn(
								"group/step relative p-6 transition-colors duration-200 hover:bg-[#2D8CFF]/[0.04] lg:p-8",
								index > 0 &&
									"border-t border-border sm:border-t-0 sm:border-l sm:border-border",
							)}
						>
							<span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[#2D8CFF] transition-transform duration-300 group-hover/step:scale-x-100" />

							<span className="font-sans text-[36px] font-extrabold leading-none text-[#2477e0] transition-colors duration-200 group-hover/step:text-[#0B5FCC]">
								{index + 1}
							</span>
							<h3 className="mt-4 font-sans text-[17px] font-bold tracking-tight text-foreground transition-transform duration-200 group-hover/step:translate-x-0.5">
								{step.title}
							</h3>
							<p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
								{step.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
