import Svg, { Circle, Ellipse, G, Path } from "react-native-svg";

export const MONKEY_COUNT = 5;

type Palette = {
	fur: string;
	face: string;
	ear: string;
	feature: string;
};

// Monochrome-forward to match the app's black/white theme, with one warm
// classic-brown unlock. face = the light muzzle/mask, feature = eyes/nose lines.
const PALETTES: Palette[] = [
	{ fur: "#23262f", face: "#edeff2", ear: "#3a3f4a", feature: "#141718" }, // charcoal
	{ fur: "#141718", face: "#e3e6ea", ear: "#2b2f36", feature: "#000000" }, // ink
	{ fur: "#6b7280", face: "#eef0f3", ear: "#565e6b", feature: "#23262f" }, // stone
	{ fur: "#4b5563", face: "#dfe4ea", ear: "#64748b", feature: "#23262f" }, // slate
	{ fur: "#8d5524", face: "#f1dab6", ear: "#a56a32", feature: "#4a2f18" }, // classic (warm)
];

// Emails-handled needed to unlock each monkey. Index 0 is always unlocked.
export const MONKEY_UNLOCKS = [0, 15, 40, 90, 180];

export const MONKEY_NAMES = ["Coco", "Mango", "Smokey", "Slate", "Nova"];

// A recognizable monkey face drawn as vector: round head, forward ears, a
// heart-shaped light mask, close-set eyes, muzzle and a small smile.
export function MonkeyAvatar({
	variant = 0,
	size = 96,
}: {
	variant?: number;
	size?: number;
}) {
	const p = PALETTES[variant % PALETTES.length];

	return (
		<Svg width={size} height={size} viewBox="0 0 100 100">
			{/* ears */}
			<Circle cx="20" cy="40" r="16" fill={p.fur} />
			<Circle cx="20" cy="40" r="8" fill={p.ear} />
			<Circle cx="80" cy="40" r="16" fill={p.fur} />
			<Circle cx="80" cy="40" r="8" fill={p.ear} />

			{/* head */}
			<Circle cx="50" cy="52" r="34" fill={p.fur} />

			{/* heart-shaped face mask */}
			<Path
				d="M50,30 C60,22 74,26 76,40 C78,53 71,65 61,73 C57,76 43,76 39,73 C29,65 22,53 24,40 C26,26 40,22 50,30 Z"
				fill={p.face}
			/>

			{/* muzzle bumps around the mouth */}
			<Ellipse cx="43" cy="63" rx="11" ry="9" fill={p.face} />
			<Ellipse cx="57" cy="63" rx="11" ry="9" fill={p.face} />

			{/* brows */}
			<Path
				d="M33,40 Q40,35 47,39"
				stroke={p.feature}
				strokeWidth="2.4"
				strokeLinecap="round"
				fill="none"
			/>
			<Path
				d="M53,39 Q60,35 67,40"
				stroke={p.feature}
				strokeWidth="2.4"
				strokeLinecap="round"
				fill="none"
			/>

			{/* eyes */}
			<G>
				<Ellipse cx="40" cy="48" rx="6.5" ry="7.5" fill="#ffffff" />
				<Ellipse cx="60" cy="48" rx="6.5" ry="7.5" fill="#ffffff" />
				<Circle cx="41" cy="49" r="3.4" fill={p.feature} />
				<Circle cx="59" cy="49" r="3.4" fill={p.feature} />
				<Circle cx="42.2" cy="47.6" r="1.1" fill="#ffffff" />
				<Circle cx="60.2" cy="47.6" r="1.1" fill="#ffffff" />
			</G>

			{/* nose */}
			<Ellipse cx="46.5" cy="60" rx="2" ry="1.6" fill={p.feature} />
			<Ellipse cx="53.5" cy="60" rx="2" ry="1.6" fill={p.feature} />

			{/* smile */}
			<Path
				d="M43,67 Q50,72 57,67"
				stroke={p.feature}
				strokeWidth="2.2"
				strokeLinecap="round"
				fill="none"
			/>
		</Svg>
	);
}
