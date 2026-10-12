"use client";

import { cn } from "@repo/ui";
import { useReducedMotion } from "framer-motion";

export type RibbonPhase =
	| "idle"
	| "listening"
	| "processing"
	| "revealing"
	| "done";

interface SpeechRibbonProps {
	words: string[];
	revealedCount: number;
	phase: RibbonPhase;
}

const PATH_ID = "speech-ribbon-path";
const PATH_D = "M -60 150 C 160 40, 380 40, 560 120 S 980 250, 1260 130";

/** Words kept on the curved trail — older ones drop off the left. */
const TRAIL_WORDS = 40;
/** Words shown crisply in the focus pill. */
const FOCUS_WORDS = 7;

/**
 * Filler phrase that rides the curved trail before the mic is live. Two copies
 * are concatenated so the string always overhangs the visible path; a second
 * <text> runs the same drift half a cycle out of phase to keep it seamless.
 */
const IDLE_TRAIL_PHRASE =
	"draft a reply · set a reminder · summarise this thread · ask me anything · catch me up · ";
const IDLE_TRAIL_TEXT = IDLE_TRAIL_PHRASE.repeat(2);
const IDLE_TRAIL_DURATION = 26;

export function SpeechRibbon({
	words,
	revealedCount,
	phase,
}: SpeechRibbonProps) {
	const reduceMotion = useReducedMotion();
	const revealed = words.slice(0, revealedCount);
	const trail = revealed.slice(-TRAIL_WORDS);
	const focus = revealed.slice(-FOCUS_WORDS).join(" ");

	// The dashed trail always drifts left→right; it just speeds up while the
	// mic is live so the ribbon reads as "flowing" with the speech.
	const dashDuration =
		phase === "listening" || phase === "revealing" || phase === "processing"
			? "2.4s"
			: "6s";
	const showDots =
		phase === "processing" || (phase === "listening" && !focus);

	const pillText = showDots
		? phase === "processing"
			? "Transcribing"
			: "Listening"
		: focus || "Tap the mic and start talking";

	// Before the mic goes live the curved trail carries a looping filler phrase
	// that drifts left→right; once recording starts it shows the real words.
	const showIdleTrail = phase === "idle";

	return (
		<div className="pointer-events-none relative mx-auto h-[190px] w-full max-w-[1100px] sm:h-[240px]">
			<svg
				viewBox="0 0 1200 260"
				fill="none"
				aria-hidden="true"
				className="absolute inset-0 h-full w-full [mask-image:linear-gradient(to_right,transparent,black_14%,black_86%,transparent)]"
			>
				<title>Live speech trail</title>
				<path
					id={PATH_ID}
					d={PATH_D}
					className="stroke-border"
					strokeWidth="2"
					strokeDasharray="1 12"
					strokeLinecap="round"
					style={
						reduceMotion
							? undefined
							: {
									animation: `sym-dash ${dashDuration} linear infinite`,
								}
					}
				/>
				{showIdleTrail ? (
					(reduceMotion ? [0] : [0, 1]).map((copy) => (
						<text
							key={copy}
							textAnchor="start"
							className="font-[family-name:var(--font-instrument)] text-[26px] italic fill-muted-foreground/55 sm:text-[30px]"
						>
							<textPath
								href={`#${PATH_ID}`}
								startOffset={reduceMotion ? "6%" : "0%"}
							>
								{IDLE_TRAIL_TEXT}
								{!reduceMotion && (
									<animate
										attributeName="startOffset"
										from="-100%"
										to="100%"
										dur={`${IDLE_TRAIL_DURATION}s`}
										begin={
											copy === 0
												? "0s"
												: `-${IDLE_TRAIL_DURATION / 2}s`
										}
										repeatCount="indefinite"
									/>
								)}
							</textPath>
						</text>
					))
				) : (
					<text
						textAnchor="end"
						className="font-[family-name:var(--font-instrument)] text-[26px] italic fill-muted-foreground/70 sm:text-[30px]"
					>
						<textPath href={`#${PATH_ID}`} startOffset="90%">
							{trail.map((word, i) => (
								<tspan
									key={`${i}-${word}`}
									className={cn(
										i === trail.length - 1 &&
											"fill-foreground",
									)}
								>
									{word}
									{i < trail.length - 1 ? " " : ""}
								</tspan>
							))}
						</textPath>
					</text>
				)}
			</svg>

			<div className="absolute left-1/2 top-[58%] w-max max-w-[92%] -translate-x-1/2 -translate-y-1/2">
				<span className="inline-flex items-center gap-2 rounded-[14px] bg-foreground px-4 py-2.5 text-[15px] font-medium text-background shadow-lg sm:px-5 sm:text-[17px]">
					{showDots && (
						<span className="flex items-end gap-[3px] pb-[3px]">
							{[0, 1, 2].map((d) => (
								<span
									key={d}
									className="size-1.5 origin-center rounded-full bg-background/80"
									style={{
										animation: `sym-wave 0.9s ease-in-out ${
											d * 0.15
										}s infinite`,
									}}
								/>
							))}
						</span>
					)}
					{pillText}
				</span>
			</div>
		</div>
	);
}
