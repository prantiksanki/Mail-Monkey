import { cn } from "@repo/ui";
import {
	InboxIcon,
	LayoutGridIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
} from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import type { ReactNode } from "react";

interface FeatureTile {
	icon: ReactNode;
	title: string;
	description: string;
}

const tiles: FeatureTile[] = [
	{
		icon: <InboxIcon className="size-6" />,
		title: "Unified inbox",
		description:
			"All your accounts in one stream. Switch views or see everything together.",
	},
	{
		icon: <LayoutGridIcon className="size-6" />,
		title: "Per-account rules",
		description:
			"Set different rules for each account. Work inbox stays different from personal.",
	},
	{
		icon: <RefreshCwIcon className="size-6" />,
		title: "Syncs in real time",
		description: "Changes reflect instantly across all connected accounts.",
	},
	{
		icon: <ShieldCheckIcon className="size-6" />,
		title: "Secure connections",
		description:
			"OAuth only. We never store your email password. Revoke access anytime.",
	},
];

export function MultiAccount() {
	return (
		<section className="w-full bg-background px-6 py-20 text-center sm:px-8 sm:py-24">
			<span className="mb-4 inline-block rounded-full bg-primary px-5 py-2 text-xs font-bold uppercase tracking-[0.3em] text-primary-foreground">
				Multi-account
			</span>
			<div className="mb-2 font-sans text-[34px] font-normal leading-[1.02] tracking-tight text-foreground sm:text-[40px] md:text-[52px]">
				Every account.
				<br />
				One place.
			</div>
			<p className="mb-3 text-[18px] leading-[1.55] text-foreground">
				Gmail, Outlook, work, side projects — all unified in a single
				view. No more juggling tabs.
			</p>
			<p className="mx-auto mb-8 max-w-2xl text-[16px] leading-7 text-foreground">
				Keep separate rules for each inbox, but manage everything from
				one calm surface.
			</p>

			<div className="mb-10 flex flex-wrap justify-center gap-3">
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border-2 border-border bg-[#0663DA] px-6 py-3 text-[15px] font-medium leading-none text-primary-foreground shadow-[2px_2px_0px_0px_#00388F] transition-all hover:translate-x-px hover:translate-y-px hover:bg-[#0663DA]/90 hover:shadow-[1px_1px_0px_0px_#00388F]"
				>
					<Image
						src="/images/gmail-logo.png"
						alt="Gmail"
						width={16}
						height={16}
						className="shrink-0 object-contain"
					/>
					Connect Gmail
				</NextLink>
				<NextLink
					href="/auth/signup"
					prefetch
					className="inline-flex items-center gap-2.5 rounded-full border-2 border-border bg-[#152238] px-6 py-3 text-[15px] font-medium leading-none text-primary-foreground shadow-[2px_2px_0px_0px_#0F1827] transition-all hover:translate-x-px hover:translate-y-px hover:bg-[#152238]/90 hover:shadow-[1px_1px_0px_0px_#0F1827]"
				>
					<Image
						src="/images/outlook-logo.png"
						alt="Outlook"
						width={16}
						height={16}
						className="shrink-0 object-contain"
					/>
					Connect Outlook
				</NextLink>
			</div>

			<div className="mx-auto grid max-w-[860px] grid-cols-1 gap-px overflow-hidden rounded-[2rem] border border-border bg-border shadow-[0_18px_50px_-32px_rgba(0,0,0,0.2)] sm:grid-cols-2">
				{tiles.map((tile, index) => {
					const isTopRow = index < 2;

					return (
						<div
							key={tile.title}
							className="group/feature relative overflow-hidden bg-card p-8 text-left"
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

							<p className="relative z-10 text-[15px] leading-[1.8] text-foreground">
								{tile.description}
							</p>
						</div>
					);
				})}
			</div>
		</section>
	);
}
