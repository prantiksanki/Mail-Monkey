"use client";

import { type CSSProperties, useEffect, useRef } from "react";

interface NoiseProps {
	patternSize?: number;
	/** How much to scale the noise pattern tiling horizontally. */
	patternScaleX?: number;
	/** How much to scale the noise pattern tiling vertically. */
	patternScaleY?: number;
	patternRefreshInterval?: number;
	patternAlpha?: number;
	intensity?: number;
}

/** Animated film-grain canvas overlay, layered on top of a gradient background. */
function Noise({
	patternSize = 100,
	patternScaleX = 1,
	patternScaleY = 1,
	patternRefreshInterval = 1,
	patternAlpha = 50,
	intensity = 1,
}: NoiseProps) {
	const grainRef = useRef<HTMLCanvasElement>(null);
	// Avoids repeated getBoundingClientRect calls inside the animation loop.
	const canvasCssSizeRef = useRef({ width: 0, height: 0 });

	useEffect(() => {
		const canvas = grainRef.current;
		if (!canvas) {
			return;
		}

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			return;
		}

		let frame = 0;
		const patternCanvas = document.createElement("canvas");
		patternCanvas.width = patternSize;
		patternCanvas.height = patternSize;

		const patternCtx = patternCanvas.getContext("2d");
		if (!patternCtx) {
			return;
		}
		const patternData = patternCtx.createImageData(
			patternSize,
			patternSize,
		);
		const patternPixelDataLength = patternSize * patternSize * 4;

		const resize = () => {
			const dpr = window.devicePixelRatio || 1;
			let newCssWidth = window.innerWidth;
			let newCssHeight = window.innerHeight;

			if (canvas.parentElement) {
				const parentRect = canvas.parentElement.getBoundingClientRect();
				newCssWidth = parentRect.width;
				newCssHeight = parentRect.height;
			}

			canvasCssSizeRef.current = {
				width: newCssWidth,
				height: newCssHeight,
			};

			canvas.width = newCssWidth * dpr;
			canvas.height = newCssHeight * dpr;

			// Draw commands below use CSS pixel units; this offsets for DPR.
			ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		};

		const updatePattern = () => {
			for (let i = 0; i < patternPixelDataLength; i += 4) {
				const value = Math.random() * 255 * intensity;
				patternData.data[i] = value;
				patternData.data[i + 1] = value;
				patternData.data[i + 2] = value;
				patternData.data[i + 3] = patternAlpha;
			}
			patternCtx.putImageData(patternData, 0, 0);
		};

		const drawGrain = () => {
			const { width: cssWidth, height: cssHeight } =
				canvasCssSizeRef.current;
			if (cssWidth === 0 || cssHeight === 0) {
				return;
			}

			ctx.clearRect(0, 0, cssWidth, cssHeight);
			ctx.save();

			const safePatternScaleX = Math.max(0.001, patternScaleX);
			const safePatternScaleY = Math.max(0.001, patternScaleY);
			ctx.scale(safePatternScaleX, safePatternScaleY);

			const fillPattern = ctx.createPattern(patternCanvas, "repeat");
			if (fillPattern) {
				ctx.fillStyle = fillPattern;
				ctx.fillRect(
					0,
					0,
					cssWidth / safePatternScaleX,
					cssHeight / safePatternScaleY,
				);
			}

			ctx.restore();
		};

		let animationFrameId: number | undefined;
		const loop = () => {
			if (
				canvasCssSizeRef.current.width > 0 &&
				canvasCssSizeRef.current.height > 0 &&
				frame % patternRefreshInterval === 0
			) {
				updatePattern();
				drawGrain();
			}
			frame++;
			animationFrameId = window.requestAnimationFrame(loop);
		};

		window.addEventListener("resize", resize);
		resize();
		if (patternRefreshInterval > 0) {
			loop();
		} else {
			updatePattern();
			drawGrain();
		}

		return () => {
			window.removeEventListener("resize", resize);
			if (animationFrameId !== undefined) {
				window.cancelAnimationFrame(animationFrameId);
			}
		};
	}, [
		patternSize,
		patternScaleX,
		patternScaleY,
		patternRefreshInterval,
		patternAlpha,
		intensity,
	]);

	return (
		<canvas
			className="absolute inset-0 size-full pointer-events-none"
			ref={grainRef}
		/>
	);
}

export interface GradientColorStop {
	color: string;
	stop: string;
}

export type GradientOrigin =
	| "bottom-middle"
	| "bottom-left"
	| "bottom-right"
	| "top-middle"
	| "top-left"
	| "top-right"
	| "left-middle"
	| "right-middle"
	| "center";

export type GradientType =
	| "radial-gradient"
	| "linear-gradient"
	| "conic-gradient";

interface GradientBackgroundProps {
	gradientType?: GradientType;
	gradientSize?: string;
	gradientOrigin?: GradientOrigin;
	colors?: GradientColorStop[];

	enableNoise?: boolean;
	noisePatternSize?: number;
	noisePatternScaleX?: number;
	noisePatternScaleY?: number;
	noisePatternRefreshInterval?: number;
	noisePatternAlpha?: number;
	noiseIntensity?: number;

	className?: string;
	style?: CSSProperties;
	children?: React.ReactNode;

	/** Overrides all other gradient props when provided. */
	customGradient?: string;
}

const GRADIENT_POSITIONS: Record<GradientOrigin, string> = {
	"bottom-middle": "50% 101%",
	"bottom-left": "0% 101%",
	"bottom-right": "100% 101%",
	"top-middle": "50% -1%",
	"top-left": "0% -1%",
	"top-right": "100% -1%",
	"left-middle": "-1% 50%",
	"right-middle": "101% 50%",
	center: "50% 50%",
};

const LINEAR_ANGLES: Record<GradientOrigin, string> = {
	"bottom-middle": "0deg",
	"bottom-left": "45deg",
	"bottom-right": "315deg",
	"top-middle": "180deg",
	"top-left": "135deg",
	"top-right": "225deg",
	"left-middle": "90deg",
	"right-middle": "270deg",
	center: "0deg",
};

const DEFAULT_COLORS: GradientColorStop[] = [
	{ color: "rgba(245,87,2,1)", stop: "10.5%" },
	{ color: "rgba(245,120,2,1)", stop: "16%" },
	{ color: "rgba(245,140,2,1)", stop: "17.5%" },
	{ color: "rgba(245,170,100,1)", stop: "25%" },
	{ color: "rgba(238,174,202,1)", stop: "40%" },
	{ color: "rgba(202,179,214,1)", stop: "65%" },
	{ color: "rgba(148,201,233,1)", stop: "100%" },
];

function generateGradient(
	gradientType: GradientType,
	gradientSize: string,
	gradientOrigin: GradientOrigin,
	colors: GradientColorStop[],
	customGradient?: string,
): string {
	if (customGradient) {
		return customGradient;
	}

	const position = GRADIENT_POSITIONS[gradientOrigin];
	const colorStops = colors
		.map(({ color, stop }) => `${color} ${stop}`)
		.join(",");

	if (gradientType === "radial-gradient") {
		return `radial-gradient(${gradientSize} at ${position},${colorStops})`;
	}
	if (gradientType === "linear-gradient") {
		const angle = LINEAR_ANGLES[gradientOrigin];
		return `linear-gradient(${angle},${colorStops})`;
	}
	if (gradientType === "conic-gradient") {
		return `conic-gradient(from 0deg at ${position},${colorStops})`;
	}
	return `${gradientType}(${colorStops})`;
}

export type NoisyGradientPreset =
	| "sunsetGlow"
	| "oceanicDepth"
	| "forestCanopy"
	| "cosmicNebula"
	| "desertDawn"
	| "fieryEmbers"
	| "lavenderDreams"
	| "arcticHaze"
	| "retroWave";

interface NoisyGradientPresetConfig {
	label: string;
	gradientOrigin: GradientOrigin;
	colors?: GradientColorStop[];
	gradientSize?: string;
	noiseIntensity: number;
	noisePatternSize: number;
	noisePatternRefreshInterval: number;
}

/** Named presets matching the component's original demo gallery. */
export const NOISY_GRADIENT_PRESETS: Record<
	NoisyGradientPreset,
	NoisyGradientPresetConfig
> = {
	sunsetGlow: {
		label: "Sunset Glow",
		gradientOrigin: "bottom-middle",
		noiseIntensity: 1.0,
		noisePatternSize: 90,
		noisePatternRefreshInterval: 2,
	},
	oceanicDepth: {
		label: "Oceanic Depth",
		gradientOrigin: "top-left",
		colors: [
			{ color: "rgba(0,20,30,1)", stop: "0%" },
			{ color: "rgba(0,51,78,1)", stop: "20%" },
			{ color: "rgba(0,119,182,1)", stop: "50%" },
			{ color: "rgba(3,169,244,1)", stop: "75%" },
			{ color: "rgba(173,216,230,1)", stop: "100%" },
		],
		noiseIntensity: 0.8,
		noisePatternSize: 100,
		noisePatternRefreshInterval: 1,
	},
	forestCanopy: {
		label: "Forest Canopy",
		gradientOrigin: "right-middle",
		colors: [
			{ color: "rgba(10,38,10,1)", stop: "0%" },
			{ color: "rgba(0,77,64,1)", stop: "25%" },
			{ color: "rgba(46,125,50,1)", stop: "50%" },
			{ color: "rgba(129,199,132,1)", stop: "75%" },
			{ color: "rgba(200,230,201,1)", stop: "100%" },
		],
		noiseIntensity: 1.2,
		noisePatternSize: 80,
		noisePatternRefreshInterval: 2,
	},
	cosmicNebula: {
		label: "Cosmic Nebula",
		gradientOrigin: "center",
		colors: [
			{ color: "rgba(26,20,50,1)", stop: "0%" },
			{ color: "rgba(76,17,88,1)", stop: "25%" },
			{ color: "rgba(142,68,173,1)", stop: "50%" },
			{ color: "rgba(233,30,99,1)", stop: "75%" },
			{ color: "rgba(255,110,199,1)", stop: "100%" },
		],
		gradientSize: "150% 150%",
		noiseIntensity: 0.7,
		noisePatternSize: 110,
		noisePatternRefreshInterval: 1,
	},
	desertDawn: {
		label: "Desert Dawn",
		gradientOrigin: "bottom-right",
		colors: [
			{ color: "rgba(120,40,40,1)", stop: "0%" },
			{ color: "rgba(188,71,73,1)", stop: "30%" },
			{ color: "rgba(244,143,177,1)", stop: "60%" },
			{ color: "rgba(252,207,178,1)", stop: "85%" },
			{ color: "rgba(255,235,215,1)", stop: "100%" },
		],
		noiseIntensity: 1.1,
		noisePatternSize: 95,
		noisePatternRefreshInterval: 2,
	},
	fieryEmbers: {
		label: "Fiery Embers",
		gradientOrigin: "left-middle",
		colors: [
			{ color: "rgba(50,0,0,1)", stop: "0%" },
			{ color: "rgba(183,28,28,1)", stop: "30%" },
			{ color: "rgba(244,67,54,1)", stop: "60%" },
			{ color: "rgba(255,152,0,1)", stop: "85%" },
			{ color: "rgba(255,235,59,1)", stop: "100%" },
		],
		noiseIntensity: 1.5,
		noisePatternSize: 70,
		noisePatternRefreshInterval: 1,
	},
	lavenderDreams: {
		label: "Lavender Dreams",
		gradientOrigin: "top-right",
		colors: [
			{ color: "rgba(49,27,69,1)", stop: "0%" },
			{ color: "rgba(94,53,177,1)", stop: "30%" },
			{ color: "rgba(179,157,219,1)", stop: "60%" },
			{ color: "rgba(237,231,246,1)", stop: "85%" },
			{ color: "rgba(250,250,250,1)", stop: "100%" },
		],
		noiseIntensity: 0.9,
		noisePatternSize: 120,
		noisePatternRefreshInterval: 2,
	},
	arcticHaze: {
		label: "Arctic Haze",
		gradientOrigin: "top-middle",
		colors: [
			{ color: "rgba(38,50,56,1)", stop: "0%" },
			{ color: "rgba(84,110,122,1)", stop: "30%" },
			{ color: "rgba(176,190,197,1)", stop: "60%" },
			{ color: "rgba(236,239,241,1)", stop: "85%" },
			{ color: "rgba(255,255,255,1)", stop: "100%" },
		],
		noiseIntensity: 1.3,
		noisePatternSize: 100,
		noisePatternRefreshInterval: 1,
	},
	retroWave: {
		label: "Retro Wave",
		gradientOrigin: "bottom-left",
		colors: [
			{ color: "rgba(255,0,150,1)", stop: "0%" },
			{ color: "rgba(200,0,200,1)", stop: "30%" },
			{ color: "rgba(0,150,255,1)", stop: "60%" },
			{ color: "rgba(0,200,200,1)", stop: "85%" },
			{ color: "rgba(255,255,100,1)", stop: "100%" },
		],
		noiseIntensity: 0.6,
		noisePatternSize: 130,
		noisePatternRefreshInterval: 2,
	},
};

/**
 * CSS gradient background with an animated film-grain overlay. Fills its
 * nearest positioned ancestor — the parent must give it explicit dimensions.
 */
export function GradientBackground({
	gradientType = "radial-gradient",
	gradientSize = "125% 125%",
	gradientOrigin = "bottom-middle",
	colors = DEFAULT_COLORS,

	enableNoise = true,
	noisePatternSize = 100,
	noisePatternScaleX = 1,
	noisePatternScaleY = 1,
	noisePatternRefreshInterval = 1,
	noisePatternAlpha = 50,
	noiseIntensity = 1,

	className = "",
	style = {},
	children,

	customGradient,
}: GradientBackgroundProps) {
	const gradientStyle: CSSProperties = {
		background: generateGradient(
			gradientType,
			gradientSize,
			gradientOrigin,
			colors,
			customGradient,
		),
		...style,
	};

	return (
		<div
			className={`absolute inset-0 size-full ${className}`}
			style={gradientStyle}
		>
			{enableNoise && (
				<Noise
					patternSize={noisePatternSize}
					patternScaleX={noisePatternScaleX}
					patternScaleY={noisePatternScaleY}
					patternRefreshInterval={noisePatternRefreshInterval}
					patternAlpha={noisePatternAlpha}
					intensity={noiseIntensity}
				/>
			)}
			{children}
		</div>
	);
}

/** Renders `GradientBackground` from one of `NOISY_GRADIENT_PRESETS` by name. */
export function NoisyGradientPresetBackground({
	preset,
	className,
}: {
	preset: NoisyGradientPreset;
	className?: string;
}) {
	const config = NOISY_GRADIENT_PRESETS[preset];
	return (
		<GradientBackground
			gradientOrigin={config.gradientOrigin}
			colors={config.colors}
			gradientSize={config.gradientSize}
			noiseIntensity={config.noiseIntensity}
			noisePatternSize={config.noisePatternSize}
			noisePatternRefreshInterval={config.noisePatternRefreshInterval}
			className={className}
		/>
	);
}
