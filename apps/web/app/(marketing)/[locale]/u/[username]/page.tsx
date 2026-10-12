import { ContactFormDialog } from "@marketing/profile/components/ContactFormDialog";
import { MediaKitSection } from "@marketing/profile/components/MediaKitSection";
import { ProfileLinkIcon } from "@marketing/profile/components/ProfileLinkIcon";
import { ProfileViewTracker } from "@marketing/profile/components/ProfileViewTracker";
import { SimilarCreators } from "@marketing/profile/components/SimilarCreators";
import {
	getPublicCreatorProfileByUsername,
	type ProfileDesign,
	type ProfileLink,
} from "@repo/database";
import { config as paymentsConfig } from "@repo/payments/config";
import { config as storageConfig } from "@repo/storage/config";
import { AnimatedGradient } from "@repo/ui/components/animated-gradient";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/avatar";
import { DarkGradientBackground } from "@repo/ui/components/dark-gradient-background";
import { FluidParticlesBackground } from "@repo/ui/components/fluid-particles-background";
import { LivingOrigamiBackground } from "@repo/ui/components/living-origami-background";
import {
	type NoisyGradientPreset,
	NoisyGradientPresetBackground,
} from "@repo/ui/components/noisy-gradient-background";
import { PaperShaderBackground } from "@repo/ui/components/paper-shader-background";
import { SoftGlowBackground } from "@repo/ui/components/soft-glow-background";
import { StarsBackground } from "@repo/ui/components/stars";
import { getBaseUrl } from "@repo/utils";
import { CalendarIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

interface PageParams {
	locale: string;
	username: string;
}

const FONT_STACKS: Record<string, string> = {
	inter: "Inter, sans-serif",
	serif: "Georgia, serif",
	rounded: "'Varela Round', ui-rounded, sans-serif",
	mono: "'JetBrains Mono', monospace",
};

// Inline SVG feTurbulence noise, blended with `overlay` to read as a subtle
// film-grain texture — the "noise" pattern (matches MyPageEditor/types.ts).
const NOISE_SVG =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)' opacity='0.35'/></svg>\")";

const BLOB_SVG =
	"url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='b'><feTurbulence type='fractalNoise' baseFrequency='0.015' numOctaves='2' seed='7'/><feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 6 -2.2'/></filter><rect width='100%25' height='100%25' filter='url(%23b)'/></svg>\")";

// Placeholder presets — matches MyPageEditor/types.ts BACKGROUND_OPTIONS.
const BACKGROUND_GRADIENTS: Record<string, [string, string]> = {
	sunset: ["#FF7A59", "#6E3BFF"],
	ocean: ["#00C2D1", "#1E3A8A"],
	forest: ["#8BC34A", "#0B3D2E"],
	candy: ["#FF6EC7", "#FFD166"],
	midnight: ["#2D2E83", "#0B0906"],
	peach: ["#FFD7B5", "#FF8C69"],
	prism: ["#050505", "#66B3FF"],
	lava: ["#FF9F21", "#FF0303"],
	plasma: ["#B566FF", "#000000"],
	pulse: ["#66FF85", "#000000"],
	vortex: ["#000000", "#FFFFFF"],
	mist: ["#050505", "#FF66B8"],
	stars: ["#262626", "#000000"],
	particles: ["#FFFFFF", "#EAEAEA"],
	sunsetGlow: ["#F55702", "#94C9E9"],
	oceanicDepth: ["#00141E", "#ADD8E6"],
	forestCanopy: ["#0A260A", "#C8E6C9"],
	cosmicNebula: ["#1A1432", "#FF6EC7"],
	desertDawn: ["#782828", "#FFEBD7"],
	fieryEmbers: ["#320000", "#FFEB3B"],
	lavenderDreams: ["#311B45", "#FAFAFA"],
	arcticHaze: ["#263238", "#FFFFFF"],
	retroWave: ["#FF0096", "#FFFF64"],
};

// Live WebGL animated-gradient presets (see @repo/ui/components/animated-gradient).
const ANIMATED_BACKGROUND_PRESETS: Record<
	string,
	"Prism" | "Lava" | "Plasma" | "Pulse" | "Vortex" | "Mist"
> = {
	prism: "Prism",
	lava: "Lava",
	plasma: "Plasma",
	pulse: "Pulse",
	vortex: "Vortex",
	mist: "Mist",
};

// Noisy CSS gradients with animated grain (see @repo/ui/components/noisy-gradient-background).
const NOISY_GRADIENT_BACKGROUND_PRESETS: Record<string, NoisyGradientPreset> = {
	sunsetGlow: "sunsetGlow",
	oceanicDepth: "oceanicDepth",
	forestCanopy: "forestCanopy",
	cosmicNebula: "cosmicNebula",
	desertDawn: "desertDawn",
	fieryEmbers: "fieryEmbers",
	lavenderDreams: "lavenderDreams",
	arcticHaze: "arcticHaze",
	retroWave: "retroWave",
};

function backgroundGradient(backgroundType: string | undefined): string {
	if (backgroundType === "violetGlow") {
		return "radial-gradient(125% 125% at 50% 10%, #000 40%, #6633EE 100%)";
	}
	const [from, to] =
		BACKGROUND_GRADIENTS[backgroundType ?? "sunset"] ??
		BACKGROUND_GRADIENTS.sunset;
	return `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;
}

function wallpaperBackgroundImage(
	wallpaperStyle: string | undefined,
	accentColor: string,
	backgroundType: string | undefined,
): string | undefined {
	switch (wallpaperStyle) {
		case "gradient":
			return `linear-gradient(160deg, color-mix(in srgb, ${accentColor} 55%, transparent) 0%, transparent 70%)`;
		case "blur":
		case "pattern":
			return `radial-gradient(ellipse 70% 50% at 50% 8%, color-mix(in srgb, ${accentColor} 45%, transparent) 0%, color-mix(in srgb, ${accentColor} 18%, transparent) 45%, transparent 80%)`;
		case "background":
			return backgroundGradient(backgroundType);
		default:
			return undefined;
	}
}

function patternBackground(patternType: string | undefined): {
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

export async function generateMetadata({
	params,
}: {
	params: Promise<PageParams>;
}): Promise<Metadata> {
	const { username } = await params;
	const profile = await getPublicCreatorProfileByUsername(username);

	if (!profile) {
		return { title: "Profile not found" };
	}

	const displayName = profile.creatorProfile?.displayName || profile.name;
	const url = `${getBaseUrl()}/u/${username}`;
	const title = `${displayName} (@${username})`;
	const description =
		profile.creatorProfile?.bio || `Connect with ${displayName}.`;

	return {
		title,
		description,
		alternates: { canonical: url },
		openGraph: { title, description, url, type: "profile" },
		twitter: { card: "summary", title, description },
	};
}

export default async function CreatorProfilePage({
	params,
}: {
	params: Promise<PageParams>;
}) {
	const { locale, username } = await params;
	setRequestLocale(locale);

	const profile = await getPublicCreatorProfileByUsername(username);

	if (!profile) {
		notFound();
	}

	const allLinks = (profile.creatorProfile?.links ??
		[]) as unknown as ProfileLink[];
	const visibleLinks = allLinks.filter((link) => link.enabled !== false);
	const featuredLink = visibleLinks.find((link) => link.featured);
	const otherLinks = visibleLinks.filter((link) => link !== featuredLink);

	// Public-page identity: falls back to the account's name/image
	// (profile.name/profile.image) unless the creator set a My-Page-specific
	// override. Both are raw storage paths, not URLs — proxy through
	// /image-proxy/<bucket>/, matching shared/components/UserAvatar.tsx.
	const displayName = profile.creatorProfile?.displayName || profile.name;
	const avatarPath = profile.creatorProfile?.avatarUrl || profile.image;
	const avatarImageSrc = avatarPath
		? avatarPath.startsWith("http")
			? avatarPath
			: `/image-proxy/${storageConfig.bucketNames.avatars}/${avatarPath}`
		: undefined;

	const accentColor = profile.creatorProfile?.accentColor ?? "#6E3BFF";
	const isCompact = profile.creatorProfile?.layout === "COMPACT";
	const design = (profile.creatorProfile?.design ?? {}) as ProfileDesign;
	const buttonStyle = design.buttonStyle ?? "fill";
	const backgroundColor = design.backgroundColor ?? undefined;
	const textColor = design.textColor ?? undefined;
	const fontStack = FONT_STACKS[design.font ?? "inter"] ?? FONT_STACKS.inter;
	const wallpaperStyle = design.wallpaperStyle ?? "fill";
	const wallpaperImage = wallpaperBackgroundImage(
		wallpaperStyle,
		accentColor,
		design.backgroundType,
	);
	const wallpaperOpacity = design.wallpaperOpacity ?? 1;
	const isBackground = wallpaperStyle === "background";
	const animatedPreset = isBackground
		? ANIMATED_BACKGROUND_PRESETS[design.backgroundType ?? ""]
		: undefined;
	const showStars = isBackground && design.backgroundType === "stars";
	const showParticles = isBackground && design.backgroundType === "particles";
	const noisyGradientPreset = isBackground
		? NOISY_GRADIENT_BACKGROUND_PRESETS[design.backgroundType ?? ""]
		: undefined;
	const showElegantDark =
		isBackground && design.backgroundType === "elegantDark";
	const showLivingOrigami =
		isBackground && design.backgroundType === "livingOrigami";
	const showPaperShader =
		isBackground && design.backgroundType === "paperShader";
	const showSoftGlow = isBackground && design.backgroundType === "softGlow";
	const mediaKit = (profile.creatorProfile?.mediaKit ?? {}) as {
		stats?: { label: string; value: string }[];
		collaborations?: { label: string; url?: string }[];
		rateCard?: { label: string; price: string }[];
	};

	return (
		<div className="container px-6 pb-20 pt-45">
			<style>{`
				.profile-link-pill {
					background-color: color-mix(in srgb, currentColor 8%, transparent);
					border-color: transparent;
					color: inherit;
				}
				.profile-link-pill:hover {
					background-color: color-mix(in srgb, currentColor 14%, transparent);
				}
				.profile-featured-button {
					${
						buttonStyle === "outline"
							? "background-color: transparent; color: var(--profile-accent); border: 1.5px solid var(--profile-accent);"
							: buttonStyle === "soft"
								? "background-color: color-mix(in srgb, var(--profile-accent) 12%, transparent); color: var(--profile-accent);"
								: "background-color: var(--profile-accent); color: white;"
					}
				}
				.profile-muted-text {
					color: color-mix(in srgb, currentColor 55%, transparent);
				}
				.profile-booking-card {
					border-color: color-mix(in srgb, currentColor 12%, transparent);
					background-color: color-mix(in srgb, currentColor 4%, transparent);
				}
			`}</style>

			<div
				className={`relative mx-auto overflow-hidden rounded-3xl px-6 pb-16 ${isCompact ? "max-w-lg pt-10" : "max-w-2xl pt-16"}`}
				style={
					{
						"--profile-accent": accentColor,
						backgroundColor:
							backgroundColor ??
							(wallpaperImage ||
							animatedPreset ||
							showStars ||
							showParticles ||
							noisyGradientPreset ||
							showElegantDark ||
							showLivingOrigami ||
							showPaperShader
								? "#0b0906"
								: "#ffffff"),
						color:
							textColor ??
							(wallpaperImage ||
							animatedPreset ||
							showStars ||
							showParticles ||
							noisyGradientPreset ||
							showElegantDark ||
							showLivingOrigami ||
							showPaperShader
								? "#ffffff"
								: "#111111"),
						fontFamily: fontStack,
					} as React.CSSProperties
				}
			>
				{showSoftGlow ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<SoftGlowBackground className="size-full" />
					</div>
				) : showPaperShader ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<PaperShaderBackground className="size-full" />
					</div>
				) : showLivingOrigami ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<LivingOrigamiBackground className="size-full" />
					</div>
				) : showElegantDark ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<DarkGradientBackground className="size-full" />
					</div>
				) : noisyGradientPreset ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<NoisyGradientPresetBackground
							preset={noisyGradientPreset}
							className="size-full"
						/>
					</div>
				) : showParticles ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<FluidParticlesBackground className="size-full" />
					</div>
				) : showStars ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<StarsBackground className="size-full" />
					</div>
				) : animatedPreset ? (
					<div
						className="pointer-events-none absolute inset-0 overflow-hidden"
						style={{ opacity: wallpaperOpacity }}
						aria-hidden="true"
					>
						<AnimatedGradient config={{ preset: animatedPreset }} />
					</div>
				) : (
					<div
						className="pointer-events-none absolute inset-0"
						style={{
							backgroundImage: wallpaperImage,
							opacity: wallpaperOpacity,
						}}
						aria-hidden="true"
					/>
				)}
				{wallpaperStyle === "pattern" && (
					<div
						className="pointer-events-none absolute inset-0 mix-blend-overlay"
						style={{
							color: textColor ?? "#ffffff",
							opacity: wallpaperOpacity * 0.2,
							...patternBackground(design.patternType),
						}}
						aria-hidden="true"
					/>
				)}
				<ProfileViewTracker username={username} />

				<div className="mx-auto flex flex-col items-center text-center">
					<Avatar
						className="rounded-full ring-2 ring-white/10"
						style={{
							width: isCompact ? 72 : 96,
							height: isCompact ? 72 : 96,
						}}
					>
						{avatarImageSrc && (
							<AvatarImage
								src={avatarImageSrc}
								alt={displayName}
								className="rounded-full"
							/>
						)}
						<AvatarFallback
							className="rounded-full text-white"
							style={{
								backgroundColor: accentColor,
								fontSize: isCompact ? "1.25rem" : "1.5rem",
							}}
						>
							{displayName.charAt(0).toUpperCase()}
						</AvatarFallback>
					</Avatar>

					<h1 className="mt-5 font-bold text-3xl tracking-tight">
						{displayName}
					</h1>
					<p className="profile-muted-text">@{profile.username}</p>

					{profile.creatorProfile?.bio && (
						<p className="profile-muted-text mt-4 max-w-md leading-relaxed">
							{profile.creatorProfile.bio}
						</p>
					)}

					{featuredLink &&
						(featuredLink.type === "contact-form" ? (
							<ContactFormDialog
								username={username}
								label={featuredLink.label}
								variant="featured"
								className="profile-featured-button mt-6 flex w-full max-w-sm items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-sm transition-opacity hover:opacity-90"
							/>
						) : (
							<a
								href={featuredLink.url}
								target="_blank"
								rel="noopener noreferrer nofollow"
								className="profile-featured-button mt-6 flex w-full max-w-sm items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-sm transition-opacity hover:opacity-90"
							>
								<ProfileLinkIcon
									platform={featuredLink.platform}
									className="size-4"
								/>
								{featuredLink.label}
							</a>
						))}

					{otherLinks.length > 0 && (
						<div className="mt-4 flex w-full max-w-sm flex-col gap-3">
							{otherLinks.map((link, index) =>
								link.type === "contact-form" ? (
									<ContactFormDialog
										key={`${link.label}-${index}`}
										username={username}
										label={link.label}
										className="profile-link-pill relative flex items-center justify-center gap-2 rounded-full px-4 py-3.5 font-medium text-sm transition-colors"
									/>
								) : (
									<a
										key={`${link.label}-${index}`}
										href={link.url}
										target="_blank"
										rel="noopener noreferrer nofollow"
										className="profile-link-pill relative flex items-center justify-center gap-2 rounded-full px-4 py-3.5 font-medium text-sm transition-colors"
									>
										<span className="-translate-y-1/2 absolute left-4 top-1/2 flex size-6 items-center justify-center">
											<ProfileLinkIcon
												platform={link.platform}
												className="size-4"
											/>
										</span>
										{link.label}
									</a>
								),
							)}
						</div>
					)}
				</div>

				{profile.creatorProfile?.mediaKitEnabled && (
					<MediaKitSection mediaKit={mediaKit} />
				)}

				{profile.creatorProfile?.bookingEnabled && (
					<div className="profile-booking-card mx-auto mt-12 flex max-w-md items-center justify-between gap-4 rounded-2xl border p-6">
						<div className="flex items-center gap-3">
							<CalendarIcon className="size-5 profile-muted-text" />
							<div>
								<p className="font-medium text-sm">
									{
										profile.creatorProfile
											.meetingLengthMinutes
									}{" "}
									min meeting
									{profile.creatorProfile
										.paidBookingEnabled &&
										` · $${paymentsConfig.paidBooking.amount}`}
								</p>
								<p className="profile-muted-text text-xs">
									Pick a time that works for you
								</p>
							</div>
						</div>
						<Link
							href={`/u/${username}/book`}
							className="profile-featured-button shrink-0 rounded-xl px-4 py-2 font-medium text-sm transition-opacity hover:opacity-90"
						>
							Book a slot
						</Link>
					</div>
				)}

				{profile.creatorProfile && (
					<SimilarCreators username={username} />
				)}
			</div>
		</div>
	);
}
