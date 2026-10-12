import type { CSSProperties, ReactNode } from "react";

// Inline SVG feTurbulence noise (matches MyPageEditor/types.ts NOISE_SVG) —
// stands in for the original component's external Framer-hosted PNG texture,
// so this doesn't depend on a third-party CDN.
const NOISE_SVG =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/></svg>\")";

const CYAN_STREAK_MASKS = [
	"linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0) 36%, rgb(0, 0, 0) 55%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 78%, rgba(0, 0, 0, 0) 97%)",
	"linear-gradient(90deg, rgba(0, 0, 0, 0) 11%, rgb(0, 0, 0) 25%, rgba(0, 0, 0, 0.55) 41%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 78%, rgba(0, 0, 0, 0) 97%)",
	"linear-gradient(90deg, rgba(0, 0, 0, 0) 9%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0.55) 28%, rgba(0, 0, 0, 0.424) 40%, rgb(0, 0, 0) 48%, rgba(0, 0, 0, 0.267) 54%, rgba(0, 0, 0, 0.13) 78%, rgb(0, 0, 0) 88%, rgba(0, 0, 0, 0) 97%)",
	"linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 17%, rgba(0, 0, 0, 0.55) 26%, rgb(0, 0, 0) 35%, rgba(0, 0, 0, 0) 47%, rgba(0, 0, 0, 0.13) 69%, rgb(0, 0, 0) 79%, rgba(0, 0, 0, 0) 97%)",
	"linear-gradient(90deg, rgba(0, 0, 0, 0) 0%, rgb(0, 0, 0) 20%, rgba(0, 0, 0, 0.55) 27%, rgb(0, 0, 0) 42%, rgba(0, 0, 0, 0) 48%, rgba(0, 0, 0, 0.13) 67%, rgb(0, 0, 0) 74%, rgb(0, 0, 0) 82%, rgba(0, 0, 0, 0.47) 88%, rgba(0, 0, 0, 0) 97%)",
];

/** Applies a CSS mask with the `-webkit-` prefix paired in for Safari. */
function maskStyle(mask: string): CSSProperties {
	return {
		mask,
		WebkitMask: mask,
	} as CSSProperties;
}

interface DarkGradientBackgroundProps {
	children?: ReactNode;
	className?: string;
}

/**
 * Dark radial-gradient background with skewed cyan light streaks, a film-grain
 * texture, and a subtle dot-pattern overlay. Fills its nearest positioned
 * ancestor — the parent must give it explicit dimensions.
 */
export function DarkGradientBackground({
	children,
	className,
}: DarkGradientBackgroundProps) {
	return (
		<div
			className={`relative size-full overflow-hidden bg-black ${className ?? ""}`}
		>
			<div className="absolute inset-0">
				<div
					className="absolute inset-0 opacity-100"
					style={{
						background:
							"radial-gradient(100% 100% at 0% 0%, rgb(46, 46, 46) 0%, rgb(0, 0, 0) 100%)",
						...maskStyle(
							"radial-gradient(125% 100% at 0% 0%, rgb(0, 0, 0) 0%, rgba(0, 0, 0, 0.224) 88.2883%, rgba(0, 0, 0, 0) 100%)",
						),
					}}
				>
					{/* Skewed fading cyan streaks */}
					{CYAN_STREAK_MASKS.map((mask, index) => (
						<div
							key={index}
							className="absolute inset-0 opacity-20"
							style={{
								background:
									"linear-gradient(rgb(0, 207, 255) 0%, rgba(0, 207, 255, 0) 100%)",
								...maskStyle(mask),
								transform: "skewX(45deg)",
							}}
						/>
					))}
				</div>
			</div>

			<div
				className="absolute inset-0 bg-repeat opacity-5"
				style={{
					backgroundImage: NOISE_SVG,
					backgroundSize: "150px 150px",
				}}
			/>

			{/* Subtle dot pattern overlay */}
			<div
				className="absolute inset-0 opacity-20"
				style={{
					backgroundImage:
						"radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)",
					backgroundSize: "20px 20px",
				}}
			/>

			{/* Subtle radial highlight */}
			<div
				className="absolute inset-0"
				style={{
					background:
						"radial-gradient(circle, rgba(30,41,59,0.2) 0%, transparent 70%)",
				}}
			/>

			{children && <div className="relative z-10">{children}</div>}
		</div>
	);
}
