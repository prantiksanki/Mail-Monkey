import { cn } from "../lib";

export function Logo({
	withLabel = true,
	className,
}: {
	className?: string;
	withLabel?: boolean;
}) {
	const mark = (
		<span
			className="inline-block size-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_12px_var(--primary)]"
			aria-hidden="true"
		/>
	);

	if (!withLabel) {
		return (
			<span
				className={cn(
					"flex items-center font-semibold text-foreground leading-none",
					className,
				)}
				role="img"
				aria-label="Zer0Email"
			>
				{mark}
			</span>
		);
	}

	return (
		<span
			className={cn(
				"flex items-center font-semibold text-foreground leading-none",
				className,
			)}
		>
			<span className="text-lg font-semibold tracking-[-0.03em]">
				Zer0Email
			</span>
		</span>
	);
}
