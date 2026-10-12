"use client";

import { cn } from "@repo/ui";
import { Loader2Icon, MicIcon, SquareIcon } from "lucide-react";

export type WaveformState = "idle" | "listening" | "processing";

interface WaveformCapsuleProps {
	state: WaveformState;
	elapsedLabel: string;
	disabled?: boolean;
	onToggle: () => void;
}

/**
 * Deterministic bar heights (0.35–1) so the server and client render the
 * same markup — no `Math.random()` at render time.
 */
const BAR_HEIGHTS = [
	0.45, 0.7, 0.55, 0.9, 0.6, 1, 0.5, 0.75, 0.4, 0.85, 0.65, 0.95, 0.5, 0.8,
	0.6, 0.7, 0.45, 1, 0.55, 0.85, 0.5, 0.75, 0.65, 0.9, 0.45, 0.7, 0.6, 0.8,
];

const BAR_MAX_PX = 30;

export function WaveformCapsule({
	state,
	elapsedLabel,
	disabled,
	onToggle,
}: WaveformCapsuleProps) {
	const isListening = state === "listening";
	const isProcessing = state === "processing";

	return (
		<div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-4 py-3 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.35)] sm:gap-4 sm:px-5">
			<button
				type="button"
				onClick={onToggle}
				disabled={disabled || isProcessing}
				aria-label={isListening ? "Stop recording" : "Start talking"}
				className={cn(
					"group relative flex size-12 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition-transform disabled:cursor-not-allowed disabled:opacity-60",
					isListening
						? "scale-105 bg-destructive shadow-destructive/40"
						: "bg-primary shadow-primary/40 hover:scale-105",
				)}
			>
				<span
					className={cn(
						"absolute inset-0 -z-10 rounded-full",
						isListening
							? "animate-ping bg-destructive/60"
							: "bg-primary/30",
					)}
				/>
				{isProcessing ? (
					<Loader2Icon className="size-5 animate-spin" />
				) : isListening ? (
					<SquareIcon className="size-4" />
				) : (
					<MicIcon className="size-5" />
				)}
			</button>

			<div className="flex h-8 items-center gap-[3px]">
				{BAR_HEIGHTS.map((h, i) => (
					<span
						key={i}
						className={cn(
							"w-[3px] origin-center rounded-full transition-[height] duration-300",
							isProcessing
								? "bg-muted-foreground/40"
								: "bg-primary/70",
						)}
						style={{
							height: `${Math.round(h * BAR_MAX_PX)}px`,
							animation: isListening
								? `sym-wave ${0.7 + (i % 5) * 0.12}s ease-in-out ${
										(i % 7) * 0.06
									}s infinite`
								: undefined,
							transform: isListening ? undefined : "scaleY(0.16)",
						}}
					/>
				))}
			</div>

			<span className="min-w-[3.5ch] font-mono text-[11px] tabular-nums text-muted-foreground">
				{isListening ? elapsedLabel : isProcessing ? "···" : "0:00"}
			</span>
		</div>
	);
}
