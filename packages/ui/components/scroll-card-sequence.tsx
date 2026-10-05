"use client";

import { useEffect, useRef } from "react";

import { cn } from "../lib";
import type { ExpandCard } from "./expand-cards";

interface ScrollCardSequenceProps {
	cards: ExpandCard[];
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

// Extra scroll height multiplier per card (in vw) so the last card fully scrolls in
const SCROLL_VW_PER_CARD = 80;

export function ScrollCardSequence({
	cards,
	trackPaddingLeft = "0px",
}: ScrollCardSequenceProps) {
	const outerRef = useRef<HTMLDivElement>(null);
	const sectionRef = useRef<HTMLDivElement>(null);
	const trackRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const outer = outerRef.current;
		const track = trackRef.current;
		if (!outer || !track) {
			return;
		}

		function handleScroll() {
			if (!outer || !track) {
				return;
			}
			const outerRect = outer.getBoundingClientRect();
			const scrollRange = outer.offsetHeight - window.innerHeight;
			if (scrollRange <= 0) {
				return;
			}

			const progress = Math.max(
				0,
				Math.min(1, -outerRect.top / scrollRange),
			);
			track.scrollLeft =
				progress * (track.scrollWidth - track.clientWidth);
		}

		window.addEventListener("scroll", handleScroll, { passive: true });
		handleScroll();

		return () => {
			window.removeEventListener("scroll", handleScroll);
		};
	}, []);

	return (
		// Outer tall container — its height determines how long the sticky panel stays pinned
		<div
			ref={outerRef}
			style={{
				height: `calc(100vh + ${cards.length * SCROLL_VW_PER_CARD}vw)`,
			}}
		>
			{/* Sticky viewport-height panel */}
			<div
				ref={sectionRef}
				className="sticky top-0 h-screen overflow-hidden flex flex-col justify-center"
			>
				<div
					ref={trackRef}
					className="w-full overflow-x-hidden no-scrollbar"
					style={
						{
							"--track-pl": trackPaddingLeft,
						} as React.CSSProperties
					}
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
										"p-9 shrink-0",
										bg,
									)}
								>
									{/* Top: decorative number */}
									<div className="flex items-start justify-end">
										<span className="font-(family-name:--font-bricolage) text-[8rem] font-black leading-none tracking-[-0.05em] text-white/5 select-none">
											{String(idx + 1).padStart(2, "0")}
										</span>
									</div>

									<div className="flex-1" />

									{/* Bottom: title + description + CTA */}
									<div>
										<h3 className="mb-3 font-(family-name:--font-bricolage) text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.03em] text-white">
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
									{/* Top-right glow echo */}
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
			</div>
		</div>
	);
}

function splitTitle(title: string): React.ReactNode {
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
