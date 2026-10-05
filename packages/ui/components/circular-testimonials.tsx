"use client";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface Testimonial {
	quote: string;
	name: string;
	designation: string;
	src: string;
}
interface Colors {
	name?: string;
	designation?: string;
	testimony?: string;
	arrowBackground?: string;
	arrowForeground?: string;
	arrowHoverBackground?: string;
}
interface FontSizes {
	name?: string;
	designation?: string;
	quote?: string;
}
interface CircularTestimonialsProps {
	testimonials: Testimonial[];
	autoplay?: boolean;
	colors?: Colors;
	fontSizes?: FontSizes;
}

function calculateGap(width: number) {
	const minWidth = 1024;
	const maxWidth = 1456;
	const minGap = 60;
	const maxGap = 86;
	let gap: number;
	if (width <= minWidth) {
		gap = minGap;
	} else if (width >= maxWidth) {
		gap = Math.max(minGap, maxGap + 0.06018 * (width - maxWidth));
	} else {
		gap =
			minGap +
			(maxGap - minGap) * ((width - minWidth) / (maxWidth - minWidth));
	}
	// Round to nearest even number
	return Math.round(gap / 2) * 2;
}

export const CircularTestimonials = ({
	testimonials,
	autoplay = true,
	colors = {},
	fontSizes = {},
}: CircularTestimonialsProps) => {
	const colorName = colors.name ?? "#000";
	const colorDesignation = colors.designation ?? "#6b7280";
	const colorTestimony = colors.testimony ?? "#4b5563";
	const colorArrowBg = colors.arrowBackground ?? "#141414";
	const colorArrowFg = colors.arrowForeground ?? "#f1f1f7";
	const colorArrowHoverBg = colors.arrowHoverBackground ?? "#00a6fb";
	const fontSizeName = fontSizes.name ?? "1.5rem";
	const fontSizeDesignation = fontSizes.designation ?? "0.925rem";
	const fontSizeQuote = fontSizes.quote ?? "1.125rem";

	const [activeIndex, setActiveIndex] = useState(0);
	const [_hoverPrev, _setHoverPrev] = useState(false);
	const [_hoverNext, _setHoverNext] = useState(false);
	const [containerWidth, setContainerWidth] = useState(1200);

	const imageContainerRef = useRef<HTMLDivElement>(null);
	const autoplayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
		null,
	);

	const testimonialsLength = useMemo(
		() => testimonials.length,
		[testimonials],
	);
	const activeTestimonial = useMemo(
		() => testimonials[activeIndex],
		[activeIndex, testimonials],
	);

	useEffect(() => {
		function handleResize() {
			if (imageContainerRef.current) {
				setContainerWidth(imageContainerRef.current.offsetWidth);
			}
		}
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	useEffect(() => {
		if (autoplay) {
			autoplayIntervalRef.current = setInterval(() => {
				setActiveIndex((prev) => (prev + 1) % testimonialsLength);
			}, 5000);
		}
		return () => {
			if (autoplayIntervalRef.current) {
				clearInterval(autoplayIntervalRef.current);
			}
		};
	}, [autoplay, testimonialsLength]);

	const handleNext = useCallback(() => {
		setActiveIndex((prev) => (prev + 1) % testimonialsLength);
		if (autoplayIntervalRef.current) {
			clearInterval(autoplayIntervalRef.current);
		}
	}, [testimonialsLength]);

	const handlePrev = useCallback(() => {
		setActiveIndex(
			(prev) => (prev - 1 + testimonialsLength) % testimonialsLength,
		);
		if (autoplayIntervalRef.current) {
			clearInterval(autoplayIntervalRef.current);
		}
	}, [testimonialsLength]);

	useEffect(() => {
		const handleKey = (e: KeyboardEvent) => {
			if (e.key === "ArrowLeft") {
				handlePrev();
			}
			if (e.key === "ArrowRight") {
				handleNext();
			}
		};
		window.addEventListener("keydown", handleKey);
		return () => window.removeEventListener("keydown", handleKey);
	}, [handlePrev, handleNext]);

	function getImageStyle(index: number): React.CSSProperties {
		const gap = calculateGap(containerWidth);
		const maxStickUp = gap * 0.8;
		const isActive = index === activeIndex;
		const isLeft =
			(activeIndex - 1 + testimonialsLength) % testimonialsLength ===
			index;
		const isRight = (activeIndex + 1) % testimonialsLength === index;
		const transition = "all 0.8s cubic-bezier(.4,2,.3,1)";
		if (isActive) {
			return {
				zIndex: 3,
				opacity: 1,
				pointerEvents: "auto",
				transform:
					"translateX(0px) translateY(0px) scale(1) rotateY(0deg)",
				transition,
			};
		}
		if (isLeft) {
			return {
				zIndex: 2,
				opacity: 1,
				pointerEvents: "auto",
				transform: `translateX(-${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(15deg)`,
				transition,
			};
		}
		if (isRight) {
			return {
				zIndex: 2,
				opacity: 1,
				pointerEvents: "auto",
				transform: `translateX(${gap}px) translateY(-${maxStickUp}px) scale(0.85) rotateY(-15deg)`,
				transition,
			};
		}
		return { zIndex: 1, opacity: 0, pointerEvents: "none", transition };
	}

	const quoteVariants = {
		initial: { opacity: 0, y: 20 },
		animate: { opacity: 1, y: 0 },
		exit: { opacity: 0, y: -20 },
	};

	return (
		<>
			<style>{`
        .ct-root {
          --ct-name: ${colorName};
          --ct-designation: ${colorDesignation};
          --ct-testimony: ${colorTestimony};
          --ct-arrow-fg: ${colorArrowFg};
          --ct-arrow-bg: ${colorArrowBg};
          --ct-arrow-hover: ${colorArrowHoverBg};
          --ct-font-name: ${fontSizeName};
          --ct-font-designation: ${fontSizeDesignation};
          --ct-font-quote: ${fontSizeQuote};
        }
        .ct-name { color: var(--ct-name); font-size: var(--ct-font-name); }
        .ct-designation { color: var(--ct-designation); font-size: var(--ct-font-designation); }
        .ct-quote { color: var(--ct-testimony); font-size: var(--ct-font-quote); }
        .ct-arrow-btn { background-color: var(--ct-arrow-bg); }
        .ct-arrow-btn:hover { background-color: var(--ct-arrow-hover); }
        .ct-arrow-icon { color: var(--ct-arrow-fg) !important; stroke: var(--ct-arrow-fg) !important; }
      `}</style>
			<div className="ct-root w-full max-w-4xl p-8">
				<div className="grid gap-20 md:grid-cols-2">
					{/* Images */}
					<div
						className="perspective-[1000px] relative h-96 w-full"
						ref={imageContainerRef}
					>
						{testimonials.map((testimonial, index) => (
							<img
								key={testimonial.src}
								src={testimonial.src}
								alt={testimonial.name}
								className="absolute left-0 top-0 h-full w-full rounded-3xl object-cover shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
								style={getImageStyle(index)}
							/>
						))}
					</div>

					{/* Content */}
					<div className="flex flex-col justify-between">
						<AnimatePresence mode="wait">
							<motion.div
								key={activeIndex}
								variants={quoteVariants}
								initial="initial"
								animate="animate"
								exit="exit"
								transition={{
									duration: 0.3,
									ease: "easeInOut",
								}}
							>
								<h3 className="ct-name mb-1 font-bold">
									{activeTestimonial.name}
								</h3>
								<p className="ct-designation mb-8">
									{activeTestimonial.designation}
								</p>
								<motion.p className="ct-quote leading-7">
									{activeTestimonial.quote
										.split(" ")
										.map((word, i) => (
											<motion.span
												key={i}
												initial={{
													filter: "blur(10px)",
													opacity: 0,
													y: 5,
												}}
												animate={{
													filter: "blur(0px)",
													opacity: 1,
													y: 0,
												}}
												transition={{
													duration: 0.22,
													ease: "easeInOut",
													delay: 0.025 * i,
												}}
												className="inline-block"
											>
												{word}&nbsp;
											</motion.span>
										))}
								</motion.p>
							</motion.div>
						</AnimatePresence>

						<div className="flex gap-6 pt-12 md:pt-0">
							<button
								type="button"
								className="ct-arrow-btn flex h-[2.7rem] w-[2.7rem] cursor-pointer items-center justify-center rounded-full border-0 transition-colors"
								onClick={handlePrev}
								aria-label="Previous testimonial"
							>
								<ArrowLeft
									size={20}
									className="ct-arrow-icon"
								/>
							</button>
							<button
								type="button"
								className="ct-arrow-btn flex h-[2.7rem] w-[2.7rem] cursor-pointer items-center justify-center rounded-full border-0 transition-colors"
								onClick={handleNext}
								aria-label="Next testimonial"
							>
								<ArrowRight
									size={20}
									className="ct-arrow-icon"
								/>
							</button>
						</div>
					</div>
				</div>
			</div>
		</>
	);
};

export default CircularTestimonials;
