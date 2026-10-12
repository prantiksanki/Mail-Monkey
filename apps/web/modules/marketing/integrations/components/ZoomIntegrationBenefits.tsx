import { cn } from "@repo/ui";

interface BenefitTile {
	title: string;
	description: string;
}

const tiles: BenefitTile[] = [
	{
		title: "Instant meeting links",
		description:
			"Every booking gets a unique Zoom link the moment it's confirmed. No setup, no copy-pasting, no waiting on you.",
	},
	{
		title: "Always up to date",
		description:
			"Reschedule or cancel and the Zoom details change everywhere at once — calendar, email, and the invitee's copy.",
	},
	{
		title: "Lives in the inbox",
		description:
			"The link lands in the confirmation Popsuites already sends. Nothing extra to check, forward, or chase.",
	},
	{
		title: "Fewer no-shows",
		description:
			"Invitees get one-click access at the moment they need it, so the meetings on the calendar actually happen.",
	},
];

export function ZoomIntegrationBenefits() {
	return (
		<section
			id="benefits"
			className="w-full scroll-mt-24 bg-background px-6 py-20 sm:px-8 sm:py-24"
		>
			<div className="mx-auto w-full max-w-6xl">
				<div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
					<div className="lg:max-w-2xl">
						<span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
							Why connect Zoom
						</span>
						<h2 className="mt-3 font-sans text-[32px] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-[40px]">
							Less setup. More meetings kept.
						</h2>
					</div>
					<p className="max-w-sm text-[14px] leading-[1.7] text-muted-foreground lg:pt-1">
						Popsuites and Zoom together mean every booking already
						has what it needs — the link, the reminder, the
						follow-up — without you touching a thing.
					</p>
				</div>

				<div className="mt-14 grid grid-cols-1 overflow-hidden rounded-2xl border border-border sm:grid-cols-2 lg:grid-cols-4">
					{tiles.map((tile, index) => (
						<div
							key={tile.title}
							className={cn(
								"group/benefit relative p-6 transition-colors duration-200 hover:bg-[#2D8CFF]/[0.04] lg:p-7",
								index > 0 &&
									"border-t border-border lg:border-t-0",
								index === 1 && "sm:border-t-0",
								index % 2 === 1 &&
									"sm:border-l sm:border-border",
								index > 0 && "lg:border-l lg:border-border",
							)}
						>
							<span className="absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-[#2D8CFF] transition-transform duration-300 group-hover/benefit:scale-x-100" />

							<span className="text-[11px] font-semibold tracking-[0.15em] text-[#2477e0] transition-colors duration-200 group-hover/benefit:text-[#0B5FCC]">
								{String(index + 1).padStart(2, "0")}
							</span>
							<h3 className="mt-3 font-sans text-[17px] font-bold tracking-tight text-foreground transition-transform duration-200 group-hover/benefit:translate-x-0.5">
								{tile.title}
							</h3>
							<p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
								{tile.description}
							</p>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
