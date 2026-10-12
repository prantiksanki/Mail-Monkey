import { cn } from "@repo/ui";
import { Card } from "@repo/ui/components/card";
import type { PropsWithChildren, ReactNode } from "react";

export function SettingsItem({
	children,
	title,
	description,
	danger,
}: PropsWithChildren<{
	title: string | ReactNode;
	description?: string | ReactNode;
	danger?: boolean;
}>) {
	return (
		<Card className="@container rounded-[2rem] border-border bg-card p-5 shadow-[0_18px_50px_-32px_rgba(0,0,0,0.24)] md:p-7">
			<div className="grid grid-cols-1 gap-5 @xl:grid-cols-[min(100%/3,300px)_auto] @xl:gap-10">
				<div className="flex shrink-0 flex-col gap-2 border-b border-border/70 pb-4 @xl:border-b-0 @xl:border-r @xl:pb-0 @xl:pr-8">
					<h3
						className={cn(
							"m-0 font-serif text-3xl font-normal leading-none tracking-tight",
							danger && "text-destructive",
						)}
					>
						{title}
					</h3>
					{description && (
						<p className="m-0 max-w-sm text-sm leading-6 text-foreground">
							{description}
						</p>
					)}
				</div>
				<div className="min-w-0">{children}</div>
			</div>
		</Card>
	);
}
