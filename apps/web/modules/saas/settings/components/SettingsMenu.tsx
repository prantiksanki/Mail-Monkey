"use client";

import { cn } from "@repo/ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function SettingsMenu({
	menuItems,
	className,
}: {
	menuItems: {
		title: string;
		avatar: ReactNode;
		items: {
			title: string;
			href: string;
			icon?: ReactNode;
		}[];
	}[];
	className?: string;
}) {
	const pathname = usePathname();

	const isActiveMenuItem = (href: string) => pathname.includes(href);

	// Flatten all items from all menu sections into a single array
	const allItems = menuItems.flatMap((item) => item.items);

	return (
		<div
			className={cn(
				"relative overflow-x-auto rounded-full border border-border bg-card p-1 shadow-[0_12px_32px_-24px_rgba(0,0,0,0.2)]",
				className,
			)}
		>
			<nav className="flex min-w-max gap-1">
				{allItems.map((item, index) => {
					const isActive = isActiveMenuItem(item.href);
					return (
						<Link
							key={index}
							href={item.href}
							className={cn(
								"relative rounded-full px-4 py-2.5 text-sm transition-colors",
								isActive
									? "bg-foreground text-background shadow-sm"
									: "font-medium text-foreground hover:bg-muted",
							)}
						>
							{item.title}
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
