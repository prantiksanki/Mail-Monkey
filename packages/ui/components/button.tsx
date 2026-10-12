import { Slot, Slottable } from "@radix-ui/react-slot";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import * as React from "react";
import { cn } from "../lib";
import { Spinner } from "./spinner";

const buttonVariants = cva(
	"flex items-center justify-center font-medium enabled:cursor-pointer transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&>svg]:mr-1.5 [&>svg]:opacity-60 [&>svg+svg]:hidden",
	{
		variants: {
			variant: {
				primary:
					"bg-primary text-primary-foreground hover:bg-primary/80",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80",
				glass: "border border-border bg-card/70 text-foreground hover:bg-card",
				outline:
					"border border-secondary/15 bg-transparent text-foreground hover:bg-secondary/10",
				ghost: "text-foreground hover:bg-foreground/10 hover:text-foreground",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/80",
				link: "text-primary underline-offset-4 hover:underline",
				neo: "border-2 border-border bg-card text-foreground shadow-[4px_4px_0px_0px_var(--border)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_var(--border)]",
				neoPrimary:
					"border-2 border-border bg-primary text-primary-foreground shadow-[4px_4px_0px_0px_var(--primary-deep)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-primary/90 hover:shadow-[2px_2px_0px_0px_var(--primary-deep)]",
				default:
					"text-[var(--mtext)] bg-[var(--main)] border-2 border-[var(--neo-border)] rounded-[8px] shadow-[var(--shadow)] hover:translate-x-[var(--box-shadow-x)] hover:translate-y-[var(--box-shadow-y)] hover:shadow-none",
				noShadow:
					"text-[var(--mtext)] bg-[var(--main)] border-2 border-[var(--neo-border)] rounded-[8px]",
				neutral:
					"bg-[var(--bw)] text-[var(--text)] border-2 border-[var(--neo-border)] rounded-[8px] shadow-[var(--shadow)] hover:translate-x-[var(--box-shadow-x)] hover:translate-y-[var(--box-shadow-y)] hover:shadow-none",
				reverse:
					"text-[var(--mtext)] bg-[var(--main)] border-2 border-[var(--neo-border)] rounded-[8px] hover:translate-x-[var(--reverse-box-shadow-x)] hover:translate-y-[var(--reverse-box-shadow-y)] hover:shadow-[var(--shadow)]",
			},
			size: {
				sm: "h-6 rounded-lg px-3 text-xs",
				md: "h-9 rounded-lg px-4 text-sm",
				lg: "h-12 rounded-lg px-6 text-base",
				icon: "size-8 rounded-lg [&>svg]:m-0 [&>svg]:opacity-100",
			},
		},
		defaultVariants: {
			variant: "secondary",
			size: "md",
		},
	},
);

export type ButtonProps = {
	asChild?: boolean;
	loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
	VariantProps<typeof buttonVariants>;

const Button = ({
	className,
	children,
	variant,
	size,
	asChild = false,
	loading,
	disabled,
	...props
}: ButtonProps) => {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			className={cn(buttonVariants({ variant, size, className }))}
			disabled={disabled || loading}
			{...props}
		>
			{loading && <Spinner className="mr-1.5 size-4 text-inherit" />}
			<Slottable>{children}</Slottable>
		</Comp>
	);
};

export { Button, buttonVariants };
