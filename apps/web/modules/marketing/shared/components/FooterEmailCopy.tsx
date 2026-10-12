"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";

interface FooterEmailCopyProps {
	email: string;
}

export function FooterEmailCopy({ email }: FooterEmailCopyProps) {
	const [copied, setCopied] = useState(false);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	function handleCopy() {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		navigator.clipboard.writeText(email).catch(() => {});
		setCopied(true);
		timeoutRef.current = setTimeout(() => setCopied(false), 2000);
	}

	return (
		<button
			type="button"
			onClick={handleCopy}
			aria-label={`Copy email address ${email}`}
			className="inline-flex items-center gap-3 rounded-lg border border-border bg-muted px-3 py-2 font-mono text-foreground text-sm transition hover:border-border-strong"
		>
			<span>{copied ? "Copied!" : email}</span>
			<span className="relative size-4 shrink-0">
				<Copy
					className={`absolute inset-0 size-4${copied ? " animate-fade-out" : ""}`}
				/>
				<Check
					className={`absolute inset-0 size-4 text-primary opacity-0${copied ? " animate-fade-in" : ""}`}
				/>
			</span>
		</button>
	);
}
