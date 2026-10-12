"use client";

import { cn } from "@repo/ui";
import { Input } from "@repo/ui/components/input";
import {
	AlignCenterIcon,
	AlignLeftIcon,
	CheckIcon,
	ImageIcon,
	SquareIcon,
	ZapIcon,
} from "lucide-react";
import {
	BACKGROUND_OPTIONS,
	backgroundGradient,
	type DesignData,
	FONT_OPTIONS,
	HEX_COLOR,
	PATTERN_OPTIONS,
	patternBackground,
	WALLPAPER_OPTIONS,
	wallpaperSwatchBackgroundImage,
} from "./types";

function ColorField({
	label,
	value,
	fallback,
	onChange,
}: {
	label: string;
	value: string;
	fallback: string;
	onChange: (value: string) => void;
}) {
	return (
		<div>
			<p className="mb-1.5 font-medium text-sm">{label}</p>
			<div className="flex items-center gap-2">
				<input
					type="color"
					value={HEX_COLOR.test(value) ? value : fallback}
					onChange={(e) => onChange(e.target.value)}
					className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
					aria-label={label}
				/>
				<Input
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={fallback}
					className="max-w-32 font-mono text-sm uppercase"
				/>
			</div>
		</div>
	);
}

export function DesignPanel({
	data,
	onChange,
}: {
	data: DesignData;
	onChange: (data: DesignData) => void;
}) {
	return (
		<div className="flex flex-col gap-6">
			<div>
				<p className="mb-2 font-medium text-sm">Header</p>
				<div className="grid grid-cols-2 gap-2">
					<button
						type="button"
						onClick={() =>
							onChange({ ...data, headerLayout: "STANDARD" })
						}
						className={cn(
							"flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
							data.headerLayout === "STANDARD"
								? "border-primary bg-primary/5 text-primary"
								: "border-border text-foreground/70 hover:bg-muted",
						)}
					>
						<AlignCenterIcon className="size-4" />
						Classic
					</button>
					<button
						type="button"
						onClick={() =>
							onChange({ ...data, headerLayout: "COMPACT" })
						}
						className={cn(
							"flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors",
							data.headerLayout === "COMPACT"
								? "border-primary bg-primary/5 text-primary"
								: "border-border text-foreground/70 hover:bg-muted",
						)}
					>
						<AlignLeftIcon className="size-4" />
						Compact
					</button>
				</div>
			</div>

			<div>
				<p className="mb-2 font-medium text-sm">Buttons</p>
				<div className="grid grid-cols-3 gap-2">
					{(
						[
							{ value: "fill", label: "Fill" },
							{ value: "outline", label: "Outline" },
							{ value: "soft", label: "Soft" },
						] as const
					).map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() =>
								onChange({ ...data, buttonStyle: option.value })
							}
							className={cn(
								"flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
								data.buttonStyle === option.value
									? "border-primary bg-primary/5 text-primary"
									: "border-border text-foreground/70 hover:bg-muted",
							)}
						>
							{data.buttonStyle === option.value ? (
								<CheckIcon className="size-3.5" />
							) : (
								<SquareIcon className="size-3.5" />
							)}
							{option.label}
						</button>
					))}
				</div>
			</div>

			<div>
				<p className="mb-2 font-medium text-sm">Text</p>
				<div className="grid grid-cols-2 gap-2">
					{FONT_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							onClick={() =>
								onChange({ ...data, font: option.value })
							}
							style={{ fontFamily: option.stack }}
							className={cn(
								"rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
								data.font === option.value
									? "border-primary bg-primary/5 text-primary"
									: "border-border text-foreground/70 hover:bg-muted",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<div>
				<p className="mb-2 font-medium text-sm">Colors</p>
				<div className="grid grid-cols-3 gap-4">
					<ColorField
						label="Accent"
						value={data.accentColor}
						fallback="#6E3BFF"
						onChange={(accentColor) =>
							onChange({ ...data, accentColor })
						}
					/>
					<ColorField
						label="Background"
						value={data.backgroundColor}
						fallback="#FFFFFF"
						onChange={(backgroundColor) =>
							onChange({ ...data, backgroundColor })
						}
					/>
					<ColorField
						label="Text"
						value={data.textColor}
						fallback="#111111"
						onChange={(textColor) =>
							onChange({ ...data, textColor })
						}
					/>
				</div>
			</div>

			<div>
				<div className="mb-2 flex items-center justify-between">
					<p className="font-medium text-sm">Opacity</p>
					<span className="text-foreground/60 text-sm tabular-nums">
						{Math.round(data.wallpaperOpacity * 100)}%
					</span>
				</div>
				<input
					type="range"
					min={0}
					max={100}
					value={Math.round(data.wallpaperOpacity * 100)}
					onChange={(e) =>
						onChange({
							...data,
							wallpaperOpacity: Number(e.target.value) / 100,
						})
					}
					className="w-full accent-primary"
					aria-label="Wallpaper opacity"
				/>
			</div>

			<div>
				<p className="mb-2 font-medium text-sm">Wallpaper style</p>
				<div className="grid grid-cols-6 gap-2">
					{WALLPAPER_OPTIONS.map((option) => {
						const preview = wallpaperSwatchBackgroundImage(
							option.value,
							data.accentColor || "#6E3BFF",
							data.backgroundType,
						);
						return (
							<button
								key={option.value}
								type="button"
								disabled={option.locked}
								onClick={() =>
									onChange({
										...data,
										wallpaperStyle: option.value,
									})
								}
								className={cn(
									"flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-xs transition-colors",
									option.locked
										? "cursor-not-allowed border-border text-foreground/40"
										: data.wallpaperStyle === option.value
											? "border-primary text-primary"
											: "border-border text-foreground/70 hover:bg-muted",
								)}
							>
								<span
									className={cn(
										"relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-md",
										preview || option.locked
											? "bg-[#0b0906]"
											: "bg-white",
									)}
									aria-hidden="true"
								>
									<span
										className="absolute inset-0"
										style={{ backgroundImage: preview }}
									/>
									{option.value === "pattern" && (
										<span
											className="absolute inset-0 opacity-50 mix-blend-overlay"
											style={patternBackground("noise")}
										/>
									)}
									{option.locked && (
										<>
											<ImageIcon className="relative size-4 text-white/70" />
											<span className="absolute top-0.5 right-0.5 flex size-3.5 items-center justify-center rounded-full bg-black/70">
												<ZapIcon className="size-2 fill-white text-white" />
											</span>
										</>
									)}
								</span>
								{option.label}
							</button>
						);
					})}
				</div>
			</div>

			{data.wallpaperStyle === "pattern" && (
				<div>
					<p className="mb-2 font-medium text-sm">Pattern</p>
					<div className="grid grid-cols-4 gap-2">
						{PATTERN_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								onClick={() =>
									onChange({
										...data,
										patternType: option.value,
									})
								}
								className={cn(
									"flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-xs transition-colors",
									data.patternType === option.value
										? "border-primary text-primary"
										: "border-border text-foreground/70 hover:bg-muted",
								)}
							>
								<span
									className="aspect-square w-full rounded-md bg-white text-neutral-300"
									style={patternBackground(option.value)}
									aria-hidden="true"
								/>
								{option.label}
							</button>
						))}
					</div>
				</div>
			)}

			{data.wallpaperStyle === "background" && (
				<div className="flex flex-col gap-4">
					<div>
						<p className="mb-2 font-medium text-sm">
							Static backgrounds
						</p>
						<div className="grid grid-cols-3 gap-2">
							{BACKGROUND_OPTIONS.filter(
								(option) => !option.animated,
							).map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() =>
										onChange({
											...data,
											backgroundType: option.value,
										})
									}
									className={cn(
										"flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-xs transition-colors",
										data.backgroundType === option.value
											? "border-primary text-primary"
											: "border-border text-foreground/70 hover:bg-muted",
									)}
								>
									<span
										className="aspect-square w-full overflow-hidden rounded-md"
										style={{
											backgroundImage: backgroundGradient(
												option.value,
											),
										}}
										aria-hidden="true"
									/>
									{option.label}
								</button>
							))}
						</div>
					</div>

					<div>
						<p className="mb-2 flex items-center gap-1.5 font-medium text-sm">
							<ZapIcon className="size-3.5 text-primary" />
							Animated backgrounds
						</p>
						<div className="grid grid-cols-3 gap-2">
							{BACKGROUND_OPTIONS.filter(
								(option) => option.animated,
							).map((option) => (
								<button
									key={option.value}
									type="button"
									onClick={() =>
										onChange({
											...data,
											backgroundType: option.value,
										})
									}
									className={cn(
										"flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-xs transition-colors",
										data.backgroundType === option.value
											? "border-primary text-primary"
											: "border-border text-foreground/70 hover:bg-muted",
									)}
								>
									<span
										className="aspect-square w-full overflow-hidden rounded-md"
										style={{
											backgroundImage: backgroundGradient(
												option.value,
											),
										}}
										aria-hidden="true"
									/>
									{option.label}
								</button>
							))}
						</div>
						<p className="mt-2 text-foreground/50 text-xs">
							Animated backgrounds render live in the preview and
							on your public page.
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
