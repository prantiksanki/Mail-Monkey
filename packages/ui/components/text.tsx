"use client";

import { cn } from "@repo/ui";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

const variants = {
	"heading-72": "font-semibold leading-[4.5rem] tracking-[-4.32px]",
	"heading-64": "font-semibold leading-[4rem] tracking-[-3.84px]",
	"heading-56": "font-semibold leading-[3.5rem] tracking-[-3.36px]",
	"heading-48": "font-semibold leading-[3.5rem] tracking-[-2.88px]",
	"heading-40": "font-semibold leading-[3rem] tracking-[-2.4px]",
	"heading-32": "font-semibold leading-10 tracking-[-1.28px]",
	"heading-24": "font-semibold leading-8 tracking-[-0.96px]",
	"heading-20": "font-semibold leading-[1.625rem] tracking-[-0.4px]",
	"heading-16": "font-semibold leading-6 tracking-[-0.32px]",
	"button-16": "font-medium leading-5",
	"button-14": "font-medium leading-5",
	"button-12": "font-medium leading-4",
	"label-20": "leading-8",
	"label-18": "leading-5",
	"label-16": "leading-5",
	"label-14": "leading-5",
	"label-13": "leading-4",
	"label-12": "leading-4",
	"copy-24": "leading-9",
	"copy-20": "leading-9",
	"copy-18": "leading-7",
	"copy-16": "leading-6",
	"copy-14": "leading-5",
	"copy-13": "leading-[1.125rem]",
} as const;

export type TextVariant = keyof typeof variants;
type TextAlign = "left" | "center" | "right" | "justify";
type TextTransform = "none" | "capitalize" | "uppercase" | "lowercase";

const ALIGN_CLASS: Record<TextAlign, string> = {
	left: "text-left",
	center: "text-center",
	right: "text-right",
	justify: "text-justify",
};

const TRANSFORM_CLASS: Record<TextTransform, string> = {
	none: "normal-case",
	capitalize: "capitalize",
	uppercase: "uppercase",
	lowercase: "lowercase",
};

const BREAKPOINTS = { sm: 0, md: 600, lg: 960, xl: 1200 } as const;

interface ResponsiveProp<T> {
	sm?: T;
	md?: T;
	lg?: T;
	xl?: T;
}

function isResponsiveProp<T>(
	value: T | ResponsiveProp<T>,
): value is ResponsiveProp<T> {
	return typeof value === "object" && value !== null;
}

function resolveResponsive<T>(
	value: T | ResponsiveProp<T> | undefined,
	width: number,
): T | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (!isResponsiveProp(value)) {
		return value;
	}
	let current: T | undefined;
	if (value.sm !== undefined && width >= BREAKPOINTS.sm) {
		current = value.sm;
	}
	if (value.md !== undefined && width >= BREAKPOINTS.md) {
		current = value.md;
	}
	if (value.lg !== undefined && width >= BREAKPOINTS.lg) {
		current = value.lg;
	}
	if (value.xl !== undefined && width >= BREAKPOINTS.xl) {
		current = value.xl;
	}
	return current;
}

function useResponsiveValue<T>(
	value: T | ResponsiveProp<T> | undefined,
): T | undefined {
	const [width, setWidth] = useState(() =>
		typeof window === "undefined" ? 0 : window.innerWidth,
	);

	useEffect(() => {
		const handleResize = () => setWidth(window.innerWidth);
		handleResize();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return resolveResponsive(value, width);
}

interface TextProps {
	size?: number | ResponsiveProp<number>;
	variant?: TextVariant | ResponsiveProp<TextVariant>;
	transform?: TextTransform;
	align?: TextAlign;
	monospace?: boolean;
	truncate?: boolean | number;
	className?: string;
	children?: ReactNode;
}

export function Text({
	size = 16,
	variant,
	transform,
	align,
	monospace = false,
	truncate,
	className,
	children,
}: TextProps) {
	const resolvedVariant = useResponsiveValue(variant);
	const resolvedSize = useResponsiveValue(size) ?? 16;
	const effectiveSize = resolvedVariant
		? Number.parseInt(resolvedVariant.split("-")[1], 10)
		: resolvedSize;
	const isClamped = typeof truncate === "number";

	return (
		<p
			className={cn(
				monospace ? "font-mono" : "font-sans",
				!resolvedVariant && effectiveSize >= 48 && "font-bold",
				!resolvedVariant &&
					effectiveSize >= 20 &&
					effectiveSize < 48 &&
					"font-semibold",
				!resolvedVariant && effectiveSize >= 72 && "leading-[4.5rem]",
				!resolvedVariant &&
					effectiveSize >= 64 &&
					effectiveSize < 72 &&
					"leading-[4rem]",
				!resolvedVariant &&
					effectiveSize >= 48 &&
					effectiveSize < 64 &&
					"leading-[3.5rem]",
				!resolvedVariant &&
					effectiveSize >= 32 &&
					effectiveSize < 48 &&
					"leading-10",
				!resolvedVariant &&
					effectiveSize >= 28 &&
					effectiveSize < 32 &&
					"leading-9",
				!resolvedVariant &&
					effectiveSize >= 24 &&
					effectiveSize < 28 &&
					"leading-8",
				!resolvedVariant &&
					effectiveSize >= 16 &&
					effectiveSize < 24 &&
					"leading-6",
				!resolvedVariant &&
					effectiveSize >= 14 &&
					effectiveSize < 16 &&
					"leading-5",
				!resolvedVariant &&
					effectiveSize >= 12 &&
					effectiveSize < 14 &&
					"leading-4",
				!resolvedVariant &&
					effectiveSize >= 10 &&
					effectiveSize < 12 &&
					"leading-3",
				resolvedVariant && variants[resolvedVariant],
				align && ALIGN_CLASS[align],
				transform && TRANSFORM_CLASS[transform],
				truncate === true && "truncate",
				isClamped && "overflow-hidden",
				className,
			)}
			style={{
				fontSize: `${effectiveSize}px`,
				display: isClamped ? "-webkit-box" : undefined,
				WebkitBoxOrient: isClamped ? "vertical" : undefined,
				WebkitLineClamp: isClamped ? (truncate as number) : undefined,
			}}
		>
			{children}
		</p>
	);
}
