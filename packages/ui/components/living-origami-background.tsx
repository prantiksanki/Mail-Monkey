"use client";

import { type CSSProperties, useMemo } from "react";

function random(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

interface Drifter {
	id: number;
	yStart: number;
	yEnd: number;
	rStart: number;
	rEnd: number;
	duration: number;
	delay: number;
	scale: number;
	flapDelay: number;
}

function generateDrifters(count: number): Drifter[] {
	return Array.from({ length: count }, (_, id) => ({
		id,
		yStart: random(-30, 30),
		yEnd: random(-30, 30),
		rStart: random(-30, 30),
		rEnd: random(-30, 30),
		duration: random(20, 40),
		delay: random(-40, 0),
		scale: random(0.2, 0.8),
		flapDelay: random(-4, 0),
	}));
}

interface LivingOrigamiBackgroundProps {
	/** Number of cranes drifting across the field at once. */
	craneCount?: number;
	className?: string;
}

/**
 * A flock of glowing low-poly origami cranes drifting across a dark field,
 * built from CSS 3D transforms and procedurally randomized flight paths.
 * Fills its nearest positioned ancestor — the parent must give it explicit
 * dimensions. Each mount re-rolls the flock's random paths.
 */
export function LivingOrigamiBackground({
	craneCount = 15,
	className,
}: LivingOrigamiBackgroundProps) {
	const drifters = useMemo(() => generateDrifters(craneCount), [craneCount]);

	return (
		<div
			className={`relative size-full overflow-hidden bg-[#05060a] ${className ?? ""}`}
		>
			<style>{`
				@keyframes living-origami-drift {
					0% {
						transform: translateX(-20%) translateY(var(--living-origami-y-start)) rotateZ(var(--living-origami-r-start));
					}
					100% {
						transform: translateX(120%) translateY(var(--living-origami-y-end)) rotateZ(var(--living-origami-r-end));
					}
				}
				@keyframes living-origami-bob {
					0%, 100% { transform: translateY(-10px); }
					50% { transform: translateY(10px); }
				}
				@keyframes living-origami-flap-left {
					0%, 100% { transform: translateZ(15px) rotateY(-60deg) skewX(20deg) rotateX(10deg); }
					50% { transform: translateZ(15px) rotateY(-60deg) skewX(20deg) rotateX(-20deg); }
				}
				@keyframes living-origami-flap-right {
					0%, 100% { transform: translateZ(15px) rotateY(60deg) skewX(-20deg) rotateX(10deg); }
					50% { transform: translateZ(15px) rotateY(60deg) skewX(-20deg) rotateX(-20deg); }
				}
				.living-origami-drifter {
					position: absolute;
					top: 50%;
					left: 0;
					animation-name: living-origami-drift;
					animation-timing-function: linear;
					animation-iteration-count: infinite;
				}
				.living-origami-crane {
					position: relative;
					width: 80px;
					height: 80px;
					transform-style: preserve-3d;
					animation: living-origami-bob 4s ease-in-out infinite;
					filter: drop-shadow(0 0 6px rgba(180, 210, 255, 0.55));
				}
				.living-origami-part {
					position: absolute;
					background: linear-gradient(135deg, rgba(235, 242, 255, 0.95), rgba(160, 190, 255, 0.55));
				}
				.living-origami-body {
					top: 20px;
					left: 30px;
					width: 20px;
					height: 40px;
					clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
				}
				.living-origami-wing-left {
					top: 25px;
					left: 40px;
					width: 40px;
					height: 30px;
					transform-origin: right center;
					clip-path: polygon(100% 0%, 100% 100%, 0% 50%);
					animation: living-origami-flap-left 1.4s ease-in-out infinite;
				}
				.living-origami-wing-right {
					top: 25px;
					left: 0px;
					width: 40px;
					height: 30px;
					transform-origin: left center;
					clip-path: polygon(0% 0%, 0% 100%, 100% 50%);
					animation: living-origami-flap-right 1.4s ease-in-out infinite;
				}
				.living-origami-tail {
					top: 55px;
					left: 33px;
					width: 14px;
					height: 22px;
					clip-path: polygon(50% 100%, 100% 0%, 0% 0%);
					opacity: 0.85;
				}
			`}</style>
			{drifters.map((drifter) => (
				<div
					key={drifter.id}
					className="living-origami-drifter"
					style={
						{
							"--living-origami-y-start": `${drifter.yStart}vh`,
							"--living-origami-y-end": `${drifter.yEnd}vh`,
							"--living-origami-r-start": `${drifter.rStart}deg`,
							"--living-origami-r-end": `${drifter.rEnd}deg`,
							animationDuration: `${drifter.duration}s`,
							animationDelay: `${drifter.delay}s`,
						} as CSSProperties
					}
				>
					<div
						className="living-origami-crane"
						style={{
							transform: `scale(${drifter.scale})`,
							animationDelay: `${drifter.flapDelay}s`,
						}}
					>
						<div className="living-origami-part living-origami-body" />
						<div className="living-origami-part living-origami-wing-left" />
						<div className="living-origami-part living-origami-wing-right" />
						<div className="living-origami-part living-origami-tail" />
					</div>
				</div>
			))}
		</div>
	);
}
