"use client";

import type { ReactNode } from "react";

import { cn } from "../lib";

export interface ExpandCard {
	icon: ReactNode;
	title: string;
	description: string;
}

interface ExpandCardsProps {
	cards: ExpandCard[];
	/** Left offset (px or rem string) to align track with section content padding */
	trackPaddingLeft?: string;
}

const CARD_GRADIENTS = [
	{
		bg: "bg-gradient-to-b from-[#050f08] to-[#0a1a0f]",
		glowClass: "[background:rgba(48,209,88,0.28)]",
	},
	{
		bg: "bg-gradient-to-b from-[#05080f] to-[#0a0d1a]",
		glowClass: "[background:rgba(48,160,209,0.22)]",
	},
	{
		bg: "bg-gradient-to-b from-[#0f0800] to-[#1a1000]",
		glowClass: "[background:rgba(209,150,48,0.22)]",
	},
	{
		bg: "bg-gradient-to-b from-[#08050f] to-[#100a1a]",
		glowClass: "[background:rgba(130,48,209,0.22)]",
	},
	{
		bg: "bg-gradient-to-b from-[#001008] to-[#001a10]",
		glowClass: "[background:rgba(48,209,160,0.22)]",
	},
	{
		bg: "bg-gradient-to-b from-[#100c00] to-[#1a1600]",
		glowClass: "[background:rgba(209,185,48,0.22)]",
	},
];

export function ExpandCards({
	cards,
	trackPaddingLeft = "0px",
}: ExpandCardsProps) {
	return (
		<div
			className="w-full overflow-x-auto no-scrollbar [scroll-snap-type:x_mandatory]"
			style={{ "--track-pl": trackPaddingLeft } as React.CSSProperties}
		>
			<div className="flex gap-4 w-max pr-6 pl-(--track-pl)">
				{cards.map((card, idx) => {
					const { bg, glowClass } =
						CARD_GRADIENTS[idx % CARD_GRADIENTS.length];

					return (
						<div
							key={card.title}
							className={cn(
								"relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.07]",
								"w-[85vw] sm:w-[75vw] lg:w-[31vw]",
								"h-125 lg:h-140",
								"snap-start",
								"p-9 shrink-0",
								bg,
							)}
						>
							{/* ── Top area: decorative number ── */}
							<div className="flex items-start justify-end">
								{/* Decorative index number — fills the void */}
								<span className="font-[family-name:var(--font-bricolage)] text-[8rem] font-black leading-none tracking-[-0.05em] text-white/[0.05] select-none">
									{String(idx + 1).padStart(2, "0")}
								</span>
							</div>

							{/* ── Spacer so text block sits in lower ~55% ── */}
							<div className="flex-1" />

							{/* ── Bottom area: title + description + CTA ── */}
							<div>
								<h3 className="mb-3 font-[family-name:var(--font-bricolage)] text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
									{splitTitle(card.title)}
								</h3>
								<p className="mb-8 text-[15px] leading-[1.65] text-white/50">
									{card.description}
								</p>

								<button
									type="button"
									className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-[12px] font-bold uppercase tracking-widest text-white/60 transition-colors duration-200 hover:border-white/40 hover:text-white"
								>
									<span>Learn more</span>
									<svg
										width="10"
										height="10"
										viewBox="0 0 10 10"
										fill="none"
										aria-hidden="true"
									>
										<path
											d="M2 5h6M5.5 2.5 8 5l-2.5 2.5"
											stroke="currentColor"
											strokeWidth="1.2"
											strokeLinecap="round"
											strokeLinejoin="round"
										/>
									</svg>
								</button>
							</div>

							{/* Glow bloom */}
							<div
								className={cn(
									"pointer-events-none absolute -bottom-10 -right-10 size-72 rounded-full blur-3xl",
									glowClass,
								)}
							/>

							{/* Top-right glow echo (softer, smaller) */}
							<div
								className={cn(
									"pointer-events-none absolute -top-16 -right-16 size-64 rounded-full blur-3xl opacity-40",
									glowClass,
								)}
							/>
						</div>
					);
				})}
			</div>
		</div>
	);
}

/** Break a title string at roughly the midpoint (last word of first half) for two-line display */
function splitTitle(title: string): ReactNode {
	const words = title.split(" ");
	if (words.length <= 2) {
		return title;
	}
	const mid = Math.ceil(words.length / 2);
	return (
		<>
			{words.slice(0, mid).join(" ")}
			<br />
			{words.slice(mid).join(" ")}
		</>
	);
}
