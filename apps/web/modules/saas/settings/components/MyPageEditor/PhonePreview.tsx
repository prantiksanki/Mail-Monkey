"use client";

import { cn } from "@repo/ui";
import { AnimatedGradient } from "@repo/ui/components/animated-gradient";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@repo/ui/components/avatar";
import { DarkGradientBackground } from "@repo/ui/components/dark-gradient-background";
import { FluidParticlesBackground } from "@repo/ui/components/fluid-particles-background";
import { LivingOrigamiBackground } from "@repo/ui/components/living-origami-background";
import { NoisyGradientPresetBackground } from "@repo/ui/components/noisy-gradient-background";
import { PaperShaderBackground } from "@repo/ui/components/paper-shader-background";
import { SoftGlowBackground } from "@repo/ui/components/soft-glow-background";
import { StarsBackground } from "@repo/ui/components/stars";
import { MailIcon } from "lucide-react";

import { PLATFORM_META } from "./platforms";
import {
	avatarSrc,
	type Block,
	backgroundAnimatedPreset,
	backgroundNoisyGradientPreset,
	DAY_KEYS,
	type DesignData,
	FONT_OPTIONS,
	HEX_COLOR,
	isElegantDarkBackground,
	isLivingOrigamiBackground,
	isPaperShaderBackground,
	isParticlesBackground,
	isSoftGlowBackground,
	isStarsBackground,
	patternBackground,
	wallpaperBackgroundImage,
} from "./types";

function initials(name: string) {
	return (
		name
			.trim()
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? "")
			.join("") || "?"
	);
}

function formatHour(time: string) {
	const [hourStr, minuteStr] = time.split(":");
	const hour = Number(hourStr);
	const period = hour >= 12 ? "pm" : "am";
	const displayHour = hour % 12 === 0 ? 12 : hour % 12;
	return minuteStr === "00"
		? `${displayHour}${period}`
		: `${displayHour}:${minuteStr}${period}`;
}

function safeColor(value: string, fallback: string) {
	return HEX_COLOR.test(value) ? value : fallback;
}

function buttonStyleClasses(
	buttonStyle: DesignData["buttonStyle"],
	accentColor: string,
): React.CSSProperties {
	if (buttonStyle === "outline") {
		return {
			backgroundColor: "transparent",
			color: accentColor,
			border: `1.5px solid ${accentColor}`,
		};
	}
	if (buttonStyle === "soft") {
		return { backgroundColor: `${accentColor}1A`, color: accentColor };
	}
	return { backgroundColor: accentColor, color: "#fff" };
}

export function PhonePreview({
	blocks,
	design,
}: {
	blocks: Block[];
	design: DesignData;
}) {
	const profile = blocks.find(
		(b): b is Extract<Block, { type: "profile" }> => b.type === "profile",
	);
	const links = blocks.find(
		(b): b is Extract<Block, { type: "links" }> => b.type === "links",
	);
	const booking = blocks.find(
		(b): b is Extract<Block, { type: "booking" }> => b.type === "booking",
	);

	const featuredLink = links?.data.find((l) => l.enabled && l.featured);
	const otherLinks = links?.data.filter(
		(l) => l.enabled && l.id !== featuredLink?.id,
	);

	const accentColor = safeColor(design.accentColor, "#6E3BFF");
	const backgroundColor = safeColor(design.backgroundColor, "#FFFFFF");
	const textColor = safeColor(design.textColor, "#111111");
	const fontStack =
		FONT_OPTIONS.find((f) => f.value === design.font)?.stack ??
		FONT_OPTIONS[0].stack;
	const isCompact = design.headerLayout === "COMPACT";
	const isBackground = design.wallpaperStyle === "background";
	const animatedPreset = isBackground
		? backgroundAnimatedPreset(design.backgroundType)
		: undefined;
	const showStars = isBackground && isStarsBackground(design.backgroundType);
	const showParticles =
		isBackground && isParticlesBackground(design.backgroundType);
	const noisyGradientPreset = isBackground
		? backgroundNoisyGradientPreset(design.backgroundType)
		: undefined;
	const showElegantDark =
		isBackground && isElegantDarkBackground(design.backgroundType);
	const showLivingOrigami =
		isBackground && isLivingOrigamiBackground(design.backgroundType);
	const showPaperShader =
		isBackground && isPaperShaderBackground(design.backgroundType);
	const showSoftGlow =
		isBackground && isSoftGlowBackground(design.backgroundType);

	return (
		<div className="sticky top-6 flex flex-col items-center">
			<div className="relative rounded-[3.5rem] border-12 border-neutral-900 bg-neutral-900 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.35)]">
				<div className="absolute top-0 left-1/2 z-10 h-7 w-40 -translate-x-1/2 rounded-b-2xl bg-neutral-900" />
				<div
					className="relative h-[900px] w-[420px] overflow-y-auto rounded-[2.8rem]"
					style={{
						backgroundColor,
						color: textColor,
						fontFamily: fontStack,
					}}
				>
					{showSoftGlow ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<SoftGlowBackground className="size-full" />
						</div>
					) : showPaperShader ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<PaperShaderBackground className="size-full" />
						</div>
					) : showLivingOrigami ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<LivingOrigamiBackground className="size-full" />
						</div>
					) : showElegantDark ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<DarkGradientBackground className="size-full" />
						</div>
					) : noisyGradientPreset ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<NoisyGradientPresetBackground
								preset={noisyGradientPreset}
								className="size-full"
							/>
						</div>
					) : showParticles ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<FluidParticlesBackground className="size-full" />
						</div>
					) : showStars ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<StarsBackground className="size-full" />
						</div>
					) : animatedPreset ? (
						<div
							className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2.8rem]"
							style={{ opacity: design.wallpaperOpacity }}
							aria-hidden="true"
						>
							<AnimatedGradient
								config={{ preset: animatedPreset }}
							/>
						</div>
					) : (
						<div
							className="pointer-events-none absolute inset-0 rounded-[2.8rem]"
							style={{
								backgroundImage: wallpaperBackgroundImage(
									design.wallpaperStyle,
									accentColor,
									design.backgroundType,
								),
								opacity: design.wallpaperOpacity,
							}}
							aria-hidden="true"
						/>
					)}
					{design.wallpaperStyle === "pattern" && (
						<div
							className="pointer-events-none absolute inset-0 rounded-[2.8rem] mix-blend-overlay"
							style={{
								color: textColor,
								opacity: design.wallpaperOpacity * 0.2,
								...patternBackground(design.patternType),
							}}
							aria-hidden="true"
						/>
					)}
					<div className="flex flex-col gap-6 px-7 pt-12 pb-8">
						{profile?.enabled && (
							<div
								className={cn(
									"flex flex-col items-center gap-2 text-center",
									isCompact && "flex-row text-left",
								)}
							>
								<Avatar
									className={cn(
										"rounded-full",
										isCompact ? "size-12" : "size-20",
									)}
								>
									{profile.data.avatarUrl && (
										<AvatarImage
											src={avatarSrc(
												profile.data.avatarUrl,
											)}
										/>
									)}
									<AvatarFallback
										className="rounded-full bg-[#EEF2FF] text-[#4F46E5]"
										style={{
											fontSize: isCompact
												? "0.95rem"
												: "1.375rem",
										}}
									>
										{initials(profile.data.displayName)}
									</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-semibold text-base">
										{profile.data.displayName ||
											"Your name"}
									</p>
									<p className="text-sm opacity-50">
										@{profile.data.username}
									</p>
									{!isCompact && profile.data.bio && (
										<p className="mt-1 text-sm leading-relaxed opacity-70">
											{profile.data.bio}
										</p>
									)}
								</div>
							</div>
						)}

						{links?.enabled && (
							<div className="flex flex-col gap-2">
								{featuredLink && (
									<div
										className="w-full truncate rounded-xl px-5 py-3.5 text-center font-medium text-base"
										style={buttonStyleClasses(
											design.buttonStyle,
											accentColor,
										)}
									>
										{featuredLink.type === "contact-form"
											? "Message me"
											: featuredLink.label ||
												"Featured link"}
									</div>
								)}
								{otherLinks?.map((link) => (
									<div
										key={link.id}
										className="flex items-center gap-2.5 rounded-xl px-4 py-3"
										style={buttonStyleClasses(
											design.buttonStyle,
											accentColor,
										)}
									>
										<div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-black/10">
											{link.type === "contact-form" ? (
												<MailIcon className="size-4" />
											) : (
												PLATFORM_META[
													link.platform
												].icon("size-4")
											)}
										</div>
										<span className="truncate text-sm">
											{link.label || "Untitled link"}
										</span>
									</div>
								))}
							</div>
						)}

						{booking?.enabled && (
							<div
								className="rounded-xl border p-4"
								style={{ borderColor: `${textColor}1A` }}
							>
								<p className="mb-2.5 font-medium text-sm">
									Availability
								</p>
								<div className="grid grid-cols-7 gap-1.5 text-center">
									{DAY_KEYS.map((label, i) => {
										const window = booking.data.days[i];
										return (
											<div
												key={label}
												className="flex flex-col gap-1"
											>
												<span className="text-[11px] opacity-40">
													{label}
												</span>
												<div
													className="flex flex-col rounded-md py-1.5 text-[9px] leading-tight"
													style={
														window
															? {
																	backgroundColor: `${accentColor}1A`,
																	color: accentColor,
																}
															: {
																	backgroundColor: `${textColor}0D`,
																	color: `${textColor}66`,
																}
													}
												>
													{window ? (
														<>
															<span>
																{formatHour(
																	window.startTime,
																)}
															</span>
															<span>
																{formatHour(
																	window.endTime,
																)}
															</span>
														</>
													) : (
														<span>—</span>
													)}
												</div>
											</div>
										);
									})}
								</div>
								{booking.data.note && (
									<p className="mt-2.5 text-[11px] leading-relaxed opacity-50">
										{booking.data.note}
									</p>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
