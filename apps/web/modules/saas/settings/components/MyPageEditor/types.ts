import { config as storageConfig } from "@repo/storage/config";

export const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export type BlockType = "profile" | "links" | "booking";

export type ProfileData = {
	displayName: string;
	username: string;
	bio: string;
	avatarUrl: string | null;
};

/**
 * Resolves a profile avatar value to a src usable by `<AvatarImage>`.
 * `avatarUrl` is the raw storage path (`${user.id}.png?v=...`), not a URL, so
 * it needs the same `/image-proxy/<bucket>/` prefix as shared/UserAvatar.tsx.
 */
export function avatarSrc(avatarUrl: string | null): string | undefined {
	if (!avatarUrl) {
		return undefined;
	}
	return avatarUrl.startsWith("http")
		? avatarUrl
		: `/image-proxy/${storageConfig.bucketNames.avatars}/${avatarUrl}`;
}

export type HeaderLayout = "STANDARD" | "COMPACT";
export type ButtonStyle = "fill" | "outline" | "soft";

export const FONT_OPTIONS = [
	{ value: "inter", label: "Inter", stack: "Inter, sans-serif" },
	{ value: "serif", label: "Georgia", stack: "Georgia, serif" },
	{
		value: "rounded",
		label: "Rounded",
		stack: "'Varela Round', ui-rounded, sans-serif",
	},
	{ value: "mono", label: "Mono", stack: "'JetBrains Mono', monospace" },
] as const;

export type FontOption = (typeof FONT_OPTIONS)[number]["value"];

export const WALLPAPER_OPTIONS = [
	{ value: "fill", label: "Fill", locked: false },
	{ value: "gradient", label: "Gradient", locked: false },
	{ value: "blur", label: "Blur", locked: false },
	{ value: "pattern", label: "Pattern", locked: false },
	{ value: "image", label: "Image", locked: true },
	{ value: "background", label: "Background", locked: false },
] as const;

export type WallpaperStyle = (typeof WALLPAPER_OPTIONS)[number]["value"];

export const PATTERN_OPTIONS = [
	{ value: "noise", label: "Noise" },
	{ value: "grid", label: "Grid" },
	{ value: "blob", label: "Blob" },
	{ value: "dots", label: "Dots" },
] as const;

export type PatternType = (typeof PATTERN_OPTIONS)[number]["value"];

// Placeholder static presets — swapped out once real background designs are provided.
export const BACKGROUND_OPTIONS = [
	{
		value: "sunset",
		label: "Sunset",
		colors: ["#FF7A59", "#6E3BFF"] as const,
		animated: false,
	},
	{
		value: "ocean",
		label: "Ocean",
		colors: ["#00C2D1", "#1E3A8A"] as const,
		animated: false,
	},
	{
		value: "forest",
		label: "Forest",
		colors: ["#8BC34A", "#0B3D2E"] as const,
		animated: false,
	},
	{
		value: "candy",
		label: "Candy",
		colors: ["#FF6EC7", "#FFD166"] as const,
		animated: false,
	},
	{
		value: "midnight",
		label: "Midnight",
		colors: ["#2D2E83", "#0B0906"] as const,
		animated: false,
	},
	{
		value: "peach",
		label: "Peach",
		colors: ["#FFD7B5", "#FF8C69"] as const,
		animated: false,
	},
	// Live WebGL animated-gradient presets (see @repo/ui/components/animated-gradient).
	// `colors` here are only a static-preview fallback (picker swatch, SSR, <canvas>-less contexts).
	{
		value: "prism",
		label: "Prism",
		colors: ["#050505", "#66B3FF"] as const,
		animated: true,
	},
	{
		value: "lava",
		label: "Lava",
		colors: ["#FF9F21", "#FF0303"] as const,
		animated: true,
	},
	{
		value: "plasma",
		label: "Plasma",
		colors: ["#B566FF", "#000000"] as const,
		animated: true,
	},
	{
		value: "pulse",
		label: "Pulse",
		colors: ["#66FF85", "#000000"] as const,
		animated: true,
	},
	{
		value: "vortex",
		label: "Vortex",
		colors: ["#000000", "#FFFFFF"] as const,
		animated: true,
	},
	{
		value: "mist",
		label: "Mist",
		colors: ["#050505", "#FF66B8"] as const,
		animated: true,
	},
	// Mouse-reactive parallax starfield (see @repo/ui/components/stars).
	{
		value: "stars",
		label: "Stars",
		colors: ["#262626", "#000000"] as const,
		animated: true,
	},
	// Perlin-noise fluid particle field (see @repo/ui/components/fluid-particles-background).
	{
		value: "particles",
		label: "Particles",
		colors: ["#FFFFFF", "#EAEAEA"] as const,
		animated: true,
	},
	// Noisy CSS gradients with animated grain (see @repo/ui/components/noisy-gradient-background).
	{
		value: "sunsetGlow",
		label: "Sunset Glow",
		colors: ["#F55702", "#94C9E9"] as const,
		animated: true,
	},
	{
		value: "oceanicDepth",
		label: "Oceanic Depth",
		colors: ["#00141E", "#ADD8E6"] as const,
		animated: true,
	},
	{
		value: "forestCanopy",
		label: "Forest Canopy",
		colors: ["#0A260A", "#C8E6C9"] as const,
		animated: true,
	},
	{
		value: "cosmicNebula",
		label: "Cosmic Nebula",
		colors: ["#1A1432", "#FF6EC7"] as const,
		animated: true,
	},
	{
		value: "desertDawn",
		label: "Desert Dawn",
		colors: ["#782828", "#FFEBD7"] as const,
		animated: true,
	},
	{
		value: "fieryEmbers",
		label: "Fiery Embers",
		colors: ["#320000", "#FFEB3B"] as const,
		animated: true,
	},
	{
		value: "lavenderDreams",
		label: "Lavender Dreams",
		colors: ["#311B45", "#FAFAFA"] as const,
		animated: true,
	},
	{
		value: "arcticHaze",
		label: "Arctic Haze",
		colors: ["#263238", "#FFFFFF"] as const,
		animated: true,
	},
	{
		value: "retroWave",
		label: "Retro Wave",
		colors: ["#FF0096", "#FFFF64"] as const,
		animated: true,
	},
	// Static radial-gradient CSS snippet (see backgroundGradient()'s "violetGlow" case).
	{
		value: "violetGlow",
		label: "Violet Glow",
		colors: ["#000000", "#6633EE"] as const,
		animated: false,
	},
	// Dark gradient with skewed cyan streaks + grain (see @repo/ui/components/dark-gradient-background).
	{
		value: "elegantDark",
		label: "Elegant Dark",
		colors: ["#2E2E2E", "#000000"] as const,
		animated: true,
	},
	// Flock of drifting origami cranes (see @repo/ui/components/living-origami-background).
	{
		value: "livingOrigami",
		label: "Living Origami",
		colors: ["#05060A", "#A0BEFF"] as const,
		animated: true,
	},
	// Glowing WebGL shader plane + energy ring, raw Three.js (see @repo/ui/components/paper-shader-background).
	{
		value: "paperShader",
		label: "Paper Shader",
		colors: ["#000000", "#FF5722"] as const,
		animated: true,
	},
	// Soft radial glow multiplied onto white (see @repo/ui/components/soft-glow-background).
	{
		value: "softGlow",
		label: "Soft Glow",
		colors: ["#FFFFFF", "#FFF991"] as const,
		animated: false,
	},
] as const;

export type BackgroundType = (typeof BACKGROUND_OPTIONS)[number]["value"];

/** Maps an animated `BackgroundType` to its `AnimatedGradientPreset` name; `undefined` for non-gradient presets. */
export function backgroundAnimatedPreset(
	backgroundType: BackgroundType,
): "Prism" | "Lava" | "Plasma" | "Pulse" | "Vortex" | "Mist" | undefined {
	switch (backgroundType) {
		case "prism":
			return "Prism";
		case "lava":
			return "Lava";
		case "plasma":
			return "Plasma";
		case "pulse":
			return "Pulse";
		case "vortex":
			return "Vortex";
		case "mist":
			return "Mist";
		default:
			return undefined;
	}
}

/** Whether `backgroundType` should render the live `StarsBackground` parallax starfield. */
export function isStarsBackground(backgroundType: BackgroundType): boolean {
	return backgroundType === "stars";
}

const NOISY_GRADIENT_TYPES = [
	"sunsetGlow",
	"oceanicDepth",
	"forestCanopy",
	"cosmicNebula",
	"desertDawn",
	"fieryEmbers",
	"lavenderDreams",
	"arcticHaze",
	"retroWave",
] as const;

export type NoisyGradientBackgroundType = (typeof NOISY_GRADIENT_TYPES)[number];

/** Maps a `BackgroundType` to its `NoisyGradientPreset` name (see @repo/ui/components/noisy-gradient-background); `undefined` if not a noisy-gradient preset. */
export function backgroundNoisyGradientPreset(
	backgroundType: BackgroundType,
): NoisyGradientBackgroundType | undefined {
	return (NOISY_GRADIENT_TYPES as readonly string[]).includes(backgroundType)
		? (backgroundType as NoisyGradientBackgroundType)
		: undefined;
}

/** Whether `backgroundType` should render the live `FluidParticlesBackground`. */
export function isParticlesBackground(backgroundType: BackgroundType): boolean {
	return backgroundType === "particles";
}

/** Whether `backgroundType` should render the live `DarkGradientBackground` (skewed cyan streaks + grain). */
export function isElegantDarkBackground(
	backgroundType: BackgroundType,
): boolean {
	return backgroundType === "elegantDark";
}

/** Whether `backgroundType` should render the live `LivingOrigamiBackground` (drifting cranes). */
export function isLivingOrigamiBackground(
	backgroundType: BackgroundType,
): boolean {
	return backgroundType === "livingOrigami";
}

/** Whether `backgroundType` should render the live `PaperShaderBackground` (WebGL shader plane + ring). */
export function isPaperShaderBackground(
	backgroundType: BackgroundType,
): boolean {
	return backgroundType === "paperShader";
}

/** Whether `backgroundType` should render the live `SoftGlowBackground` (multiply-blended radial glow on white). */
export function isSoftGlowBackground(backgroundType: BackgroundType): boolean {
	return backgroundType === "softGlow";
}

export type DesignData = {
	headerLayout: HeaderLayout;
	buttonStyle: ButtonStyle;
	accentColor: string;
	backgroundColor: string;
	textColor: string;
	font: FontOption;
	wallpaperStyle: WallpaperStyle;
	patternType: PatternType;
	backgroundType: BackgroundType;
	wallpaperOpacity: number;
};

export type LinkType = "url" | "contact-form";

export type Platform =
	| "website"
	| "instagram"
	| "facebook"
	| "x"
	| "linkedin"
	| "github"
	| "tiktok"
	| "youtube"
	| "custom";

export type LinkRow = {
	id: string;
	type: LinkType;
	platform: Platform;
	label: string;
	url: string;
	enabled: boolean;
	featured: boolean;
};

export const DAY_KEYS = [
	"Mon",
	"Tue",
	"Wed",
	"Thu",
	"Fri",
	"Sat",
	"Sun",
] as const;

export type DayWindow = { startTime: string; endTime: string } | null;

export type BookingData = {
	days: Record<number, DayWindow>;
	note: string;
};

export type Block =
	| { id: string; type: "profile"; enabled: boolean; data: ProfileData }
	| { id: string; type: "links"; enabled: boolean; data: LinkRow[] }
	| { id: string; type: "booking"; enabled: boolean; data: BookingData };

function colorMix(color: string, percent: number) {
	return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

// Inline SVG feTurbulence noise, blended with `overlay` to read as a subtle
// film-grain texture — the "noise" pattern.
const NOISE_SVG =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/></svg>\")";

// Organic blob shapes via fractal-noise turbulence (no external image) — the
// "blob" pattern. The alpha ramp (`0 0 0 6 -2.2`) keeps the mask mostly
// translucent so it reads as a faint texture, not a bold graphic print.
const BLOB_SVG =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.015' numOctaves='2' seed='7'/><feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 6 -2.2'/></filter><rect width='100%25' height='100%25' filter='url(%23b)'/></svg>\")";

/** `background-image` + `background-size` for a tiled pattern layer. */
export function patternBackground(patternType: PatternType): {
	backgroundImage: string;
	backgroundSize: string;
} {
	switch (patternType) {
		case "grid":
			return {
				backgroundImage:
					"linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
				backgroundSize: "16px 16px",
			};
		case "dots":
			return {
				backgroundImage:
					"radial-gradient(currentColor 1.5px, transparent 1.5px)",
				backgroundSize: "14px 14px",
			};
		case "blob":
			return { backgroundImage: BLOB_SVG, backgroundSize: "200px 200px" };
		default:
			return {
				backgroundImage: NOISE_SVG,
				backgroundSize: "120px 120px",
			};
	}
}

/** Full-strength (no transparency) diagonal gradient for a background preset. */
export function backgroundGradient(backgroundType: BackgroundType): string {
	if (backgroundType === "violetGlow") {
		return "radial-gradient(125% 125% at 50% 10%, #000 40%, #6633EE 100%)";
	}
	const option =
		BACKGROUND_OPTIONS.find((b) => b.value === backgroundType) ??
		BACKGROUND_OPTIONS[0];
	const [from, to] = option.colors;
	return `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;
}

/**
 * CSS `background-image` for the card-scale wallpaper (fills the whole
 * profile card). `gradient` and `blur` both radiate from the accent color;
 * `blur` is darker/warmer to read as a soft ambient glow. `fill` has no
 * image layer; `pattern`'s tiled texture is layered separately (see
 * `patternBackground`) since it needs its own `background-size`.
 * `background` uses one of the curated preset gradients instead of the
 * accent color.
 */
export function wallpaperBackgroundImage(
	wallpaperStyle: WallpaperStyle,
	accentColor: string,
	backgroundType: BackgroundType = "sunset",
): string | undefined {
	switch (wallpaperStyle) {
		case "gradient":
			return `linear-gradient(160deg, ${colorMix(accentColor, 55)} 0%, transparent 70%)`;
		case "blur":
		case "pattern":
			return `radial-gradient(ellipse 70% 50% at 50% 8%, ${colorMix(accentColor, 45)} 0%, ${colorMix(accentColor, 18)} 45%, transparent 80%)`;
		case "background":
			return backgroundGradient(backgroundType);
		default:
			return undefined;
	}
}

/**
 * Small rectangular preview tile background (e.g. a picker swatch) — same
 * treatment as the card-scale version but centered so the glow reads at a
 * compact size instead of clipping at the top edge.
 */
export function wallpaperSwatchBackgroundImage(
	wallpaperStyle: WallpaperStyle,
	accentColor: string,
	backgroundType: BackgroundType = "sunset",
): string | undefined {
	switch (wallpaperStyle) {
		case "gradient":
			return `linear-gradient(160deg, ${colorMix(accentColor, 65)} 0%, transparent 100%)`;
		case "blur":
		case "pattern":
			return `radial-gradient(circle at 50% 35%, ${colorMix(accentColor, 55)} 0%, ${colorMix(accentColor, 15)} 60%, transparent 100%)`;
		case "background":
			return backgroundGradient(backgroundType);
		default:
			return undefined;
	}
}
