"use client";

import {
	AnimatePresence,
	type MotionValue,
	motion,
	useMotionValue,
	useSpring,
	useTransform,
} from "framer-motion";
import Image from "next/image";
import { type ReactNode, useRef, useState } from "react";

const aiPrompt =
	"MailMonkey (https://mailmonkey.app) makes sure nothing in your inbox gets missed — brand deals, investor replies, client requests — the instant they land. It connects to Gmail or Outlook, automatically routes low-value noise away from the inbox, and surfaces messages that actually need attention — using intelligent routing and auto-labeling with no manual filters needed. It is built specifically for content creators who are drowning in brand deals, collabs, PR pitches, and fan messages; solo founders juggling sales, support, recruiting, and investor emails all at once; and small teams managing high volumes of client, partner, or operational email. This is not a generic email tool — it is for people whose inbox is a core part of their work but also their biggest daily distraction. Based on the site, explain what problem MailMonkey solves, who it is built for, and what makes it different from regular email filters or folders.";

const RESTING_SIZE = 48;
const MAGNIFIED_SIZE = 68;
const DISTANCE = 130;
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

interface AiProvider {
	name: string;
	href: string;
	copyPrompt: boolean;
	logo: ReactNode;
}

const aiProviders: AiProvider[] = [
	{
		name: "ChatGPT",
		href: `https://chatgpt.com/?q=${encodeURIComponent(aiPrompt)}`,
		copyPrompt: false,
		logo: (
			<svg
				viewBox="0 0 24 24"
				className="size-full text-[#10A37F]"
				aria-hidden="true"
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			>
				<path d="M11.217 19.384A3.501 3.501 0 0 0 18 18.167V13l-6-3.35" />
				<path d="M5.214 15.014A3.501 3.501 0 0 0 9.66 20.28L14 17.746V10.8" />
				<path d="M6 7.63c-1.391-.236-2.787.395-3.534 1.689a3.474 3.474 0 0 0 1.271 4.745L8 16.578l6-3.348" />
				<path d="M12.783 4.616A3.501 3.501 0 0 0 6 5.833V10.9l6 3.45" />
				<path d="M18.786 8.986A3.501 3.501 0 0 0 14.34 3.72L10 6.254V13.2" />
				<path d="M18 16.302c1.391.236 2.787-.395 3.534-1.689a3.474 3.474 0 0 0-1.271-4.745l-4.308-2.514L10 10.774" />
			</svg>
		),
	},
	{
		name: "Claude",
		href: `https://claude.ai/new?q=${encodeURIComponent(aiPrompt)}`,
		copyPrompt: false,
		logo: (
			<Image
				src="/images/Claude_AI_symbol.svg"
				alt=""
				aria-hidden="true"
				width={24}
				height={24}
				className="size-full object-contain"
			/>
		),
	},
	{
		name: "Gemini",
		href: "https://gemini.google.com/app",
		copyPrompt: true,
		logo: (
			<svg viewBox="0 0 24 24" className="size-full" aria-hidden="true">
				<defs>
					<linearGradient
						id="gemini-grad"
						x1="0%"
						y1="0%"
						x2="100%"
						y2="100%"
					>
						<stop offset="0%" stopColor="#4285F4" />
						<stop offset="50%" stopColor="#9B72CB" />
						<stop offset="100%" stopColor="#D96570" />
					</linearGradient>
				</defs>
				<path
					fill="url(#gemini-grad)"
					d="M12 24A14.304 14.304 0 0 0 0 12 14.304 14.304 0 0 0 12 0a14.305 14.305 0 0 0 12 12 14.305 14.305 0 0 0-12 12"
				/>
			</svg>
		),
	},
	{
		name: "Perplexity",
		href: `https://www.perplexity.ai/search?q=${encodeURIComponent(aiPrompt)}`,
		copyPrompt: false,
		logo: (
			<Image
				src="/images/perplexity-color.svg"
				alt=""
				aria-hidden="true"
				width={24}
				height={24}
				className="size-full object-contain"
			/>
		),
	},
];

interface DockButtonProps {
	mouseX: MotionValue<number>;
	provider: AiProvider;
	isActive: boolean;
	onActivate: () => void;
	onDeactivate: () => void;
	onCopy: () => void;
}

function DockButton({
	mouseX,
	provider,
	isActive,
	onActivate,
	onDeactivate,
	onCopy,
}: DockButtonProps) {
	const ref = useRef<HTMLAnchorElement>(null);

	const distance = useTransform(mouseX, (value) => {
		const bounds = ref.current?.getBoundingClientRect();
		if (!bounds) {
			return DISTANCE;
		}
		return value - (bounds.left + bounds.width / 2);
	});

	const targetSize = useTransform(
		distance,
		[-DISTANCE, 0, DISTANCE],
		[RESTING_SIZE, MAGNIFIED_SIZE, RESTING_SIZE],
	);
	const size = useSpring(targetSize, SPRING);
	const iconSize = useTransform(size, (value) => value * 0.42);

	return (
		<motion.a
			ref={ref}
			href={provider.href}
			target="_blank"
			rel="noreferrer"
			onClick={provider.copyPrompt ? onCopy : undefined}
			aria-label={`Ask ${provider.name} about MailMonkey`}
			onMouseEnter={onActivate}
			onMouseLeave={onDeactivate}
			onFocus={onActivate}
			onBlur={onDeactivate}
			style={{ width: size, height: size }}
			className="relative flex shrink-0 items-center justify-center rounded-full bg-white text-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white"
		>
			<AnimatePresence>
				{isActive && (
					<motion.span
						initial={{ opacity: 0, y: 0 }}
						animate={{ opacity: 1, y: -10 }}
						exit={{ opacity: 0, y: 0 }}
						transition={{ duration: 0.2 }}
						className="-translate-x-1/2 absolute bottom-full left-1/2 mb-2 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-sm"
					>
						{provider.name}
					</motion.span>
				)}
			</AnimatePresence>
			<motion.span
				style={{ width: iconSize, height: iconSize }}
				className="flex items-center justify-center"
			>
				{provider.logo}
			</motion.span>
		</motion.a>
	);
}

/**
 * "Ask AI about MailMonkey" provider row with the same macOS-dock-style
 * hover magnify as {@link FollowUsDock}: the icon under the cursor grows,
 * neighbours scale by distance, and a label fades/lifts in above the
 * active icon. Extra headroom only opens while an icon is active.
 */
export function AiProviderButtons() {
	const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
	const [activeName, setActiveName] = useState<string | null>(null);

	return (
		// Static top gutter reserves room for the magnified icon + tooltip.
		// It must not react to `activeName`: animating the padding on hover
		// translates the row out from under a stationary cursor, which fires
		// mouseleave -> clears state -> padding springs back -> mouseenter,
		// looping the icons up and down forever.
		<div className="pt-8">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse position tracked to drive dock magnification only; the icons themselves are real focusable <a>s */}
			<div
				className="flex h-12 items-end gap-3"
				onMouseMove={(event) => mouseX.set(event.clientX)}
				onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
			>
				{aiProviders.map((provider) => (
					<DockButton
						key={provider.name}
						mouseX={mouseX}
						provider={provider}
						isActive={activeName === provider.name}
						onActivate={() => setActiveName(provider.name)}
						onDeactivate={() =>
							setActiveName((current) =>
								current === provider.name ? null : current,
							)
						}
						onCopy={() => {
							navigator.clipboard
								.writeText(aiPrompt)
								.catch(() => {});
						}}
					/>
				))}
			</div>
		</div>
	);
}
