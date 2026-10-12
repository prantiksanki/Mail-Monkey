"use client";

import { cn } from "@repo/ui";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

interface ThemeToggleProps {
	className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
	const { resolvedTheme, setTheme } = useTheme();
	const isDark = resolvedTheme === "dark";

	return (
		<button
			type="button"
			className={cn(
				"flex w-16 h-8 p-1 rounded-full cursor-pointer transition-all duration-300 bg-background border border-border",
				className,
			)}
			onClick={() => setTheme(isDark ? "light" : "dark")}
		>
			<div className="flex justify-between items-center w-full">
				<div
					className={cn(
						"flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300",
						isDark
							? "transform translate-x-0 bg-muted"
							: "transform translate-x-8 bg-muted",
					)}
				>
					{isDark ? (
						<MoonIcon
							className="w-4 h-4 text-foreground"
							strokeWidth={1.5}
						/>
					) : (
						<SunIcon
							className="w-4 h-4 text-muted-foreground"
							strokeWidth={1.5}
						/>
					)}
				</div>
				<div
					className={cn(
						"flex justify-center items-center w-6 h-6 rounded-full transition-transform duration-300",
						isDark ? "bg-transparent" : "transform -translate-x-8",
					)}
				>
					{isDark ? (
						<SunIcon
							className="w-4 h-4 text-muted-foreground"
							strokeWidth={1.5}
						/>
					) : (
						<MoonIcon
							className="w-4 h-4 text-foreground"
							strokeWidth={1.5}
						/>
					)}
				</div>
			</div>
		</button>
	);
}
