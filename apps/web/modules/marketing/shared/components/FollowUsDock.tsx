"use client";

import {
	AnimatePresence,
	type MotionValue,
	motion,
	useMotionValue,
	useSpring,
	useTransform,
} from "framer-motion";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { useRef, useState } from "react";
import {
	InstagramIcon,
	TwitterXAltIcon,
	YoutubeIcon,
} from "./icons/social-icons";

const RESTING_SIZE = 32;
const MAGNIFIED_SIZE = 60;
const DISTANCE = 120;
const SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

const socialLinks = [
	{ href: "https://x.com", label: "Twitter (X)", icon: TwitterXAltIcon },
	{ href: "https://instagram.com", label: "Instagram", icon: InstagramIcon },
	{
		href: "https://www.youtube.com/@popsuitesai",
		label: "YouTube",
		icon: YoutubeIcon,
	},
] as const;

type SocialIcon = ComponentType<SVGProps<SVGSVGElement> & { size?: number }>;

interface DockIconProps {
	mouseX: MotionValue<number>;
	href: string;
	label: string;
	icon: SocialIcon;
	isActive: boolean;
	onActivate: () => void;
	onDeactivate: () => void;
}

function DockIcon({
	mouseX,
	href,
	label,
	icon: Icon,
	isActive,
	onActivate,
	onDeactivate,
}: DockIconProps) {
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

	return (
		<Link
			ref={ref}
			href={href}
			target="_blank"
			rel="noreferrer"
			aria-label={label}
			onMouseEnter={onActivate}
			onMouseLeave={onDeactivate}
			onFocus={onActivate}
			onBlur={onDeactivate}
			className="relative flex items-center justify-center text-white/70 outline-none transition-colors hover:text-white focus-visible:text-white"
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
						{label}
					</motion.span>
				)}
			</AnimatePresence>
			<motion.span
				style={{ width: size, height: size }}
				className="flex items-center justify-center"
			>
				<Icon className="size-full" />
			</motion.span>
		</Link>
	);
}

/**
 * "Follow Us" icon row with a macOS-dock-style hover magnify: the icon
 * under the cursor grows, neighbors scale down by distance, and a
 * tooltip fades/lifts in above the active icon. The row keeps a tight
 * resting gap under the heading and only opens up the extra headroom
 * a magnified icon + tooltip need while one is actually active, so it
 * doesn't sit under permanent dead space when nothing is hovered.
 */
export function FollowUsDock() {
	const mouseX = useMotionValue(Number.POSITIVE_INFINITY);
	const [activeLabel, setActiveLabel] = useState<string | null>(null);

	return (
		// Static top gutter reserves room for the magnified icon + tooltip.
		// It must not react to `activeLabel`: animating the padding on hover
		// translates the row out from under a stationary cursor, which fires
		// mouseleave -> clears state -> padding springs back -> mouseenter,
		// looping the icons up and down forever.
		<div className="pt-8">
			{/* biome-ignore lint/a11y/noStaticElementInteractions: mouse position tracked to drive dock magnification only; the icons themselves are real focusable <Link>s */}
			<div
				className="flex h-11 items-end gap-4"
				onMouseMove={(event) => mouseX.set(event.clientX)}
				onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
			>
				{socialLinks.map((link) => (
					<DockIcon
						key={link.label}
						mouseX={mouseX}
						isActive={activeLabel === link.label}
						onActivate={() => setActiveLabel(link.label)}
						onDeactivate={() =>
							setActiveLabel((current) =>
								current === link.label ? null : current,
							)
						}
						{...link}
					/>
				))}
			</div>
		</div>
	);
}
