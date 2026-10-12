"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { Children } from "react";

interface AnimatedGroupProps {
	children: ReactNode;
	className?: string;
	staggerChildren?: number;
	delayChildren?: number;
}

const itemVariants: Variants = {
	hidden: { opacity: 0, filter: "blur(12px)", y: 12 },
	visible: {
		opacity: 1,
		filter: "blur(0px)",
		y: 0,
		transition: { type: "spring", bounce: 0.3, duration: 1.5 },
	},
};

const reducedMotionItemVariants: Variants = {
	hidden: { opacity: 0 },
	visible: { opacity: 1, transition: { duration: 0.3 } },
};

/**
 * Cascades its direct children in on mount, one after another, using a
 * blur/translateY/opacity reveal. Falls back to a plain opacity fade when
 * the user has `prefers-reduced-motion` enabled. Runs once on mount only.
 */
export function AnimatedGroup({
	children,
	className,
	staggerChildren = 0.15,
	delayChildren = 0,
}: AnimatedGroupProps) {
	const shouldReduceMotion = useReducedMotion();
	const item = shouldReduceMotion ? reducedMotionItemVariants : itemVariants;

	return (
		<motion.div
			initial="hidden"
			animate="visible"
			variants={{
				hidden: {},
				visible: { transition: { staggerChildren, delayChildren } },
			}}
			className={className}
		>
			{Children.map(children, (child) => (
				<motion.div variants={item}>{child}</motion.div>
			))}
		</motion.div>
	);
}
