"use client";

import { ChevronsLeftRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ImageComparisonProps {
	beforeSrc: string;
	afterSrc: string;
	beforeContent?: React.ReactNode;
	afterContent?: React.ReactNode;
}

export function ImageComparison({
	beforeSrc,
	afterSrc,
	beforeContent,
	afterContent,
}: ImageComparisonProps) {
	const [sliderPosition, setSliderPosition] = useState(50);
	const [isDragging, setIsDragging] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	const handleMove = useCallback(
		(clientX: number) => {
			if (!isDragging || !containerRef.current) {
				return;
			}
			const rect = containerRef.current.getBoundingClientRect();
			const newPosition = Math.max(
				0,
				Math.min(100, ((clientX - rect.left) / rect.width) * 100),
			);
			setSliderPosition(newPosition);
		},
		[isDragging],
	);

	const handleMouseUp = useCallback(() => setIsDragging(false), []);

	useEffect(() => {
		window.addEventListener("mouseup", handleMouseUp);
		window.addEventListener("touchend", handleMouseUp);
		return () => {
			window.removeEventListener("mouseup", handleMouseUp);
			window.removeEventListener("touchend", handleMouseUp);
		};
	}, [handleMouseUp]);

	return (
		<div
			ref={containerRef}
			role="img"
			aria-label="Before and after comparison slider"
			className="relative w-full select-none overflow-hidden rounded-2xl shadow-2xl aspect-16/7 cursor-ew-resize"
			onMouseMove={(e) => handleMove(e.clientX)}
			onMouseLeave={handleMouseUp}
			onTouchMove={(e) => {
				e.preventDefault();
				handleMove(e.touches[0].clientX);
			}}
			onTouchEnd={handleMouseUp}
		>
			{/* ── BEFORE panel — clipped on the right past the slider ── */}
			<div
				className="absolute inset-0 bg-black"
				style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
			>
				<img
					src={beforeSrc}
					alt=""
					className="w-full h-full object-cover"
					draggable={false}
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).style.display =
							"none";
					}}
				/>
				<div className="absolute inset-0 bg-black/50" />
				{beforeContent && (
					<div className="absolute inset-0 flex items-center justify-start px-10 pointer-events-none">
						{beforeContent}
					</div>
				)}
			</div>

			{/* ── AFTER panel — clipped on the left before the slider ── */}
			<div
				className="absolute inset-0 bg-white"
				style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
			>
				<img
					src={afterSrc}
					alt=""
					className="w-full h-full object-cover"
					draggable={false}
					onError={(e) => {
						(e.currentTarget as HTMLImageElement).style.display =
							"none";
					}}
				/>
				<div className="absolute inset-0 bg-white/40" />
				{afterContent && (
					<div className="absolute inset-0 flex items-center justify-end px-10 pointer-events-none">
						{afterContent}
					</div>
				)}
			</div>

			{/* ── Slider handle ── */}
			{/* biome-ignore lint/a11y/noStaticElementInteractions: drag handle — pointer events are the interaction model */}
			<div
				className="absolute top-0 bottom-0 z-10 flex items-center justify-center"
				style={{
					left: `${sliderPosition}%`,
					transform: "translateX(-50%)",
				}}
				onMouseDown={() => setIsDragging(true)}
				onTouchStart={() => setIsDragging(true)}
			>
				<div className="absolute inset-y-0 w-0.5 bg-white/70 left-1/2 -translate-x-1/2" />
				<div
					className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg border border-gray-200 transition-transform duration-150 ${isDragging ? "scale-[1.15]" : "scale-100"}`}
				>
					<ChevronsLeftRight className="h-5 w-5 text-gray-600" />
				</div>
			</div>
		</div>
	);
}
