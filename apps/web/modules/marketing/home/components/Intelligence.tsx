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
			"Combine static conditions with AI conditions in one rule. Precise or broad — your call.",
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
			"Rules run on your account. We never sell your data. Your email stays yours — always.",
	},
];

export function Intelligence() {
	return (
		<section
			id="intelligence"
			className="w-full scroll-mt-24 bg-black px-6 py-20 text-center sm:px-8 sm:py-24"
		>
			<span className="mb-4 inline-block rounded-full bg-white px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-black">
				Intelligence
			</span>
			<div className="mb-2 font-serif text-[34px] font-normal leading-[1.02] tracking-tight text-white sm:text-[40px] md:text-[52px]">
				Email intelligence.
				<br />
				Built in.
			</div>
			<p className="mb-10 text-[18px] leading-[1.5] text-white/80">
				Zer0Email reads your mail the way you do — and acts the way you
				would.
			</p>

			<div className="mx-auto grid max-w-[980px] grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
				{tiles.map((tile) => (
					<div
						key={tile.title}
						className="bg-white/[0.03] p-8 text-left"
					>
						<span className="mb-5 flex size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white">
							{tile.icon}
						</span>
						<h4 className="mb-2 font-serif text-[28px] font-normal tracking-tight text-white">
							{tile.title}
						</h4>
						<p className="text-[13px] leading-[1.8] text-white/55">
							{tile.description}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
