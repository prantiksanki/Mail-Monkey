"use client";

import React, { type CSSProperties, useEffect, useId, useRef } from "react";

interface AnimationConfig {
	preview?: boolean;
	scale: number;
	speed: number;
}

interface NoiseConfig {
	opacity: number;
	scale: number;
}

interface ShadowOverlayProps {
	sizing?: "fill" | "stretch";
	color?: string;
	animation?: AnimationConfig;
	noise?: NoiseConfig;
	style?: CSSProperties;
	className?: string;
}

function mapRange(
	value: number,
	fromLow: number,
	fromHigh: number,
	toLow: number,
	toHigh: number,
): number {
	if (fromLow === fromHigh) {
		return toLow;
	}
	return (
		toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow)
	);
}

function useInstanceId(): string {
	const id = useId();
	return `so${id.replace(/:/g, "")}`;
}

export function EtheralShadow({
	sizing = "fill",
	color = "rgba(128, 128, 128, 1)",
	animation,
	noise,
	style,
	className,
}: ShadowOverlayProps) {
	const id = useInstanceId();
	const animationEnabled = !!(animation && animation.scale > 0);
	const feColorMatrixRef = useRef<SVGFEColorMatrixElement>(null);
	const rafRef = useRef<number>(0);
	const hueRef = useRef(0);

	const displacementScale = animation
		? mapRange(animation.scale, 1, 100, 20, 100)
		: 0;
	const animationDuration = animation
		? mapRange(animation.speed, 1, 100, 1000, 50)
		: 1;
	const baseFreqX = animation
		? mapRange(animation.scale, 0, 100, 0.001, 0.0005)
		: 0.001;
	const baseFreqY = animation
		? mapRange(animation.scale, 0, 100, 0.004, 0.002)
		: 0.004;

	// degrees per frame: full 360° in (animationDuration/25) seconds at 60fps
	const degPerFrame = 360 / ((animationDuration / 25) * 60);

	useEffect(() => {
		if (!animationEnabled) {
			return;
		}

		function tick() {
			hueRef.current = (hueRef.current + degPerFrame) % 360;
			feColorMatrixRef.current?.setAttribute(
				"values",
				String(hueRef.current),
			);
			rafRef.current = requestAnimationFrame(tick);
		}
		rafRef.current = requestAnimationFrame(tick);

		return () => cancelAnimationFrame(rafRef.current);
	}, [animationEnabled, degPerFrame]);

	const maskUrl = "url('/images/etheral-mask.png')";
	const maskSz = sizing === "stretch" ? "100% 100%" : "cover";

	return (
		<div
			className={className}
			style={{
				overflow: "hidden",
				position: "relative",
				width: "100%",
				height: "100%",
				...style,
			}}
		>
			{/*
			 * SVG lives here — OUTSIDE & ABOVE the div that applies filter:url(#id).
			 * Zero size so it has no layout impact.
			 */}
			<svg
				aria-hidden="true"
				style={{ position: "absolute", width: 0, height: 0 }}
			>
				<defs>
					<filter
						id={id}
						x="-20%"
						y="-20%"
						width="140%"
						height="140%"
					>
						<feTurbulence
							result="undulation"
							numOctaves="2"
							baseFrequency={`${baseFreqX} ${baseFreqY}`}
							seed="0"
							type="turbulence"
						/>
						<feColorMatrix
							ref={feColorMatrixRef}
							in="undulation"
							result="rotated"
							type="hueRotate"
							values="0"
						/>
						<feColorMatrix
							in="rotated"
							result="circulation"
							type="matrix"
							values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0"
						/>
						<feDisplacementMap
							in="SourceGraphic"
							in2="circulation"
							scale={displacementScale}
							result="dist"
						/>
						<feDisplacementMap
							in="dist"
							in2="undulation"
							scale={displacementScale}
						/>
					</filter>
				</defs>
			</svg>

			{/* Colored div masked by stripe PNG, warped by the filter above */}
			<div
				style={{
					position: "absolute",
					inset: -displacementScale,
					filter: animationEnabled ? `url(#${id}) blur(4px)` : "none",
				}}
			>
				<div
					style={{
						width: "100%",
						height: "100%",
						backgroundColor: color,
						maskImage: maskUrl,
						WebkitMaskImage: maskUrl,
						maskSize: maskSz,
						WebkitMaskSize: maskSz,
						maskRepeat: "no-repeat",
						WebkitMaskRepeat: "no-repeat",
						maskPosition: "center",
						WebkitMaskPosition: "center",
					}}
				/>
			</div>

			{/* Film grain */}
			{noise && noise.opacity > 0 && (
				<div
					style={{
						position: "absolute",
						inset: 0,
						backgroundImage: "url('/images/etheral-noise.png')",
						backgroundSize: noise.scale * 200,
						backgroundRepeat: "repeat",
						opacity: noise.opacity / 2,
						pointerEvents: "none",
					}}
				/>
			)}
		</div>
	);
}
