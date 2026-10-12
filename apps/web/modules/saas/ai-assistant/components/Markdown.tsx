"use client";

import { cn } from "@repo/ui";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * Compact markdown renderer for assistant replies. Styled with theme tokens so
 * it reads well in both light and dark mode inside a chat bubble.
 */
export const Markdown = memo(function Markdown({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"text-sm leading-relaxed [&_p]:my-1.5 first:[&_p]:mt-0 last:[&_p]:mb-0",
				"[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
				"[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5",
				"[&_li]:my-0.5",
				"[&_strong]:font-semibold",
				"[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
				"[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em]",
				"[&_h1]:mt-2 [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold",
				"[&_h2]:mt-2 [&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold",
				"[&_h3]:mt-2 [&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold",
				className,
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					// Open any model-emitted links in a new tab, safely.
					a: ({ node, ...props }) => (
						<a
							{...props}
							target="_blank"
							rel="noopener noreferrer"
						/>
					),
				}}
			>
				{children}
			</ReactMarkdown>
		</div>
	);
});
