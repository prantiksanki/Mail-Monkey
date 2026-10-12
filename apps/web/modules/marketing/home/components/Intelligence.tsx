import { cn } from "@repo/ui";
import {
	BrainIcon,
	LockIcon,
	ReplyIcon,
	SlidersHorizontalIcon,
	WandSparklesIcon,
	ZapIcon,
} from "lucide-react";
import type { ReactNode } from "react";

interface IntelTile {
	icon: ReactNode;
	title: string;
	description: string;
}

const tiles: IntelTile[] = [
	{
		icon: <BrainIcon className="size-[22px]" />,
		title: "Understands context",
		description:
			"Not just keywords. It understands sender, subject, body, and your past behavior to apply the right rule.",
	},
	{
		icon: <WandSparklesIcon className="size-[22px]" />,
		title: "Auto-labeling",
		description:
			"Incoming mail is categorized and labeled automatically. No manual sorting, no missed threads.",
	},
	{
		icon: <ZapIcon className="size-[22px]" />,
		title: "Instant execution",
		description:
			"Rules fire the moment mail arrives. Your inbox stays clean without you lifting a finger.",
	},
	{
		icon: <SlidersHorizontalIcon className="size-[22px]" />,
		title: "AND / OR conditions",
		description:
			"Combine static conditions with AI conditions in one rule. Precise or broad, your call.",
	},
	{
		icon: <ReplyIcon className="size-[22px]" />,
		title: "Auto-reply & forward",
		description:
			"Set rules to reply or forward automatically. Great for routing support, leads, or team mail.",
	},
	{
		icon: <LockIcon className="size-[22px]" />,
		title: "Privacy first",
		description:
			"Rules run on your account. We never sell your data. Your email stays yours, always.",
	},
];

export function Intelligence() {
	return (
		<section
			id="intelligence"
			className="w-full scroll-mt-24 bg-background px-6 py-20 text-center sm:px-8 sm:py-24"
		>
			<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				Intelligence
			</span>
			<div className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Email intelligence.
				<br />
				Built in.
			</div>
			<p className="mb-10 text-[18px] leading-[1.5] text-foreground">
				MailMonkey reads your mail the way you do — and acts the way you
				would.
			</p>

			<div className="mx-auto grid max-w-[980px] grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
				{tiles.map((tile, index) => {
					const isTopRow = index < 3;
					const isFirstColumn = index % 3 === 0;
					const isLastColumn = index % 3 === 2;

					return (
						<div
							key={tile.title}
							className={cn(
								"group/feature relative overflow-hidden border-border p-8 text-left",
								isFirstColumn && "lg:border-l",
								!isLastColumn && "lg:border-r",
								isTopRow && "lg:border-b",
							)}
						>
							<div
								className={cn(
									"pointer-events-none absolute inset-0 z-0 opacity-0 transition duration-200 group-hover/feature:opacity-100",
									isTopRow
										? "bg-gradient-to-t from-[#0663DA]/5 to-transparent"
										: "bg-gradient-to-b from-[#0663DA]/5 to-transparent",
								)}
							/>

							<span className="relative z-10 mb-5 flex size-11 items-center justify-center rounded-full border border-border bg-muted text-foreground">
								{tile.icon}
							</span>

							<div className="relative z-10 mb-2 pl-6">
								<span className="absolute inset-y-0 left-0 my-auto h-6 w-1 rounded-tr-full rounded-br-full bg-border-strong transition-all duration-200 group-hover/feature:h-8 group-hover/feature:bg-[#0663DA]" />
								<h4 className="inline-block font-sans text-[28px] font-normal tracking-tight text-foreground transition duration-200 group-hover/feature:translate-x-2">
									{tile.title}
								</h4>
							</div>

							<p className="relative z-10 text-[13px] leading-[1.8] text-foreground">
								{tile.description}
							</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}
