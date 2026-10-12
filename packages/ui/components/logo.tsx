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
				aria-label="MailMonkey"
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

	return (
		<span
			className={cn(
				"flex items-center gap-2 font-semibold text-foreground leading-none",
				className,
			)}
		>
			<img
				src="/images/logo-mark-32.png"
				alt=""
				width={32}
				height={32}
				className="size-8 shrink-0"
				aria-hidden="true"
			/>
			<span className="text-xl font-semibold tracking-[-0.03em]">
				MailMonkey
			</span>
		</span>
	);
}
