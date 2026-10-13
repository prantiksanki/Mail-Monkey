import { cn } from "../lib";

export function Logo({
	withLabel = true,
	className,
}: {
	className?: string;
	withLabel?: boolean;
}) {
	if (!withLabel) {
		return (
			<span
				className={cn(
					"flex items-center font-semibold text-foreground leading-none",
				)}
				role="img"
				aria-label="Mail Monkey"
			>
				<img
					src="/images/logo-mark-32.png"
					alt=""
					width={32}
					height={32}
					className={cn("size-6 shrink-0", className)}
					aria-hidden="true"
				/>
			</span>
		);
	}

	// Full logo (mascot + wordmark + tagline). The dark variant has the navy
	// "Mail" and tagline recoloured to white so it stays legible on dark themes.
	// Size it with a height class, e.g. className="h-12".
	return (
		<span
			className={cn("flex h-10 shrink-0 items-center", className)}
			role="img"
			aria-label="Mail Monkey"
		>
			<img
				src="/images/mailmonkey-logo.png"
				alt=""
				width={640}
				height={248}
				className="h-full w-auto dark:hidden"
				aria-hidden="true"
			/>
			<img
				src="/images/mailmonkey-logo-dark.png"
				alt=""
				width={640}
				height={248}
				className="hidden h-full w-auto dark:block"
				aria-hidden="true"
			/>
		</span>
	);
}
