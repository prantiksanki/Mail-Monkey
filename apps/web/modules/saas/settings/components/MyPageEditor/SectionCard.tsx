"use client";

import { Switch } from "@repo/ui/components/switch";
import type { PropsWithChildren, ReactNode } from "react";

export function SectionCard({
	title,
	subtitle,
	enabled,
	onToggleEnabled,
	children,
}: PropsWithChildren<{
	title: string;
	subtitle?: ReactNode;
	enabled?: boolean;
	onToggleEnabled?: (enabled: boolean) => void;
}>) {
	return (
		<div className="rounded-2xl border border-border bg-card">
			<div className="flex items-center gap-3 px-4 py-3">
				<div className="flex-1">
					<p className="font-medium text-sm">{title}</p>
					{subtitle && (
						<p className="text-foreground/50 text-xs">{subtitle}</p>
					)}
				</div>
				{onToggleEnabled && (
					<Switch
						checked={enabled}
						onCheckedChange={onToggleEnabled}
					/>
				)}
			</div>
			<div className="border-border/70 border-t px-4 py-4">
				{children}
			</div>
		</div>
	);
}
