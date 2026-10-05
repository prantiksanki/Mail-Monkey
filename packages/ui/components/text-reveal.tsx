"use client";

import {
	type MotionValue,
	motion,
	useScroll,
	useTransform,
} from "framer-motion";
import { type FC, type ReactNode, useRef } from "react";

import { cn } from "../lib";

interface TextRevealByWordProps {
	text: string;
	label?: string;
	className?: string;
}

const TextRevealByWord: FC<TextRevealByWordProps> = ({
	text,
	label,
	className,
}) => {
	const targetRef = useRef<HTMLDivElement | null>(null);

	const { scrollYProgress } = useScroll({
		target: targetRef,
		offset: ["start start", "end end"],
	});

	const words = text.split(" ");

	return (
		<section
			ref={targetRef}
			className={cn("relative h-[500vh] bg-black", className)}
		>
			<div className="sticky top-0 h-screen w-full overflow-hidden bg-black flex flex-col items-center justify-center px-12 md:px-20 lg:px-28">
				{label && (
					<p className="mb-10 font-sans text-[0.65rem] font-bold tracking-[0.28em] text-white uppercase">
						{label}
					</p>
				)}
				<p className="max-w-[60vw] text-center font-(family-name:--font-cormorant) text-[clamp(2.8rem,5.5vw,5rem)] font-normal leading-[1.2]">
					{words.map((word, i) => {
						const start = i / words.length;
						const end = start + 1 / words.length;
						return (
							<Word
								key={i}
								progress={scrollYProgress}
								range={[start, end]}
							>
								{word}
							</Word>
						);
					})}
				</p>
			</div>
		</section>
	);
};

interface WordProps {
	children: ReactNode;
	progress: MotionValue<number>;
	range: [number, number];
}

const Word: FC<WordProps> = ({ children, progress, range }) => {
	const opacity = useTransform(progress, range, [0, 1]);
	return (
		<span className="relative mr-[0.25em] inline-block">
			<span className="text-white/20">{children}</span>
			<motion.span
				style={{ opacity }}
				className="pointer-events-none absolute inset-0 text-white"
			>
				{children}
			</motion.span>
		</span>
	);
};

export { TextRevealByWord };
