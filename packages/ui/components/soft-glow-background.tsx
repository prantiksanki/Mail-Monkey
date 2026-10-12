interface SoftGlowBackgroundProps {
	/** Glow color — any valid CSS color. */
	color?: string;
	className?: string;
}

/**
 * Soft radial color glow multiplied onto a white background. Fills its
 * nearest positioned ancestor — the parent must give it explicit dimensions
 * and a light (ideally white) background for the multiply blend to read.
 */
export function SoftGlowBackground({
	color = "#FFF991",
	className,
}: SoftGlowBackgroundProps) {
	return (
		<div className={`relative size-full bg-white ${className ?? ""}`}>
			<div
				className="absolute inset-0"
				style={{
					backgroundImage: `radial-gradient(circle at center, ${color} 0%, transparent 70%)`,
					opacity: 0.6,
					mixBlendMode: "multiply",
				}}
			/>
		</div>
	);
}
