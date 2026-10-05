"use client";

import { cn } from "@repo/ui";
import { useEffect, useRef } from "react";
import { sanitizeEmailHtml } from "../lib/email-html";

/**
 * Minimal Gmail-style compose editor backed by a sanitized `contentEditable`
 * div. The forwarded/quoted email is injected as real rendered DOM (never
 * stringified or escaped), so it appears visually embedded inside the editor
 * exactly like Gmail. The user types their note above the quoted block.
 *
 * `initialHtml` seeds the editor once on mount; subsequent edits are reported
 * via `onChange` as the live `innerHTML`. The editor is uncontrolled by design
 * to avoid clobbering the caret on every keystroke.
 */
export function HtmlEditor({
	initialHtml,
	onChange,
	placeholder,
	className,
}: {
	initialHtml: string;
	onChange: (html: string) => void;
	placeholder?: string;
	className?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const seeded = useRef(false);

	// Toggles a data attribute so the CSS placeholder shows only when the editor
	// has no meaningful content (browsers leave a stray <br> after editing).
	const updateEmptyState = () => {
		if (!ref.current) {
			return;
		}
		const isEmpty =
			ref.current.textContent?.trim().length === 0 &&
			!ref.current.querySelector("img");
		ref.current.dataset.empty = isEmpty ? "true" : "false";
	};

	// Seed the editor once with sanitized rendered DOM.
	useEffect(() => {
		if (seeded.current || !ref.current) {
			return;
		}
		seeded.current = true;
		const clean = sanitizeEmailHtml(initialHtml);
		ref.current.innerHTML = clean;
		updateEmptyState();
		onChange(clean);
		// Place caret at the very start so the user types above the quote.
		ref.current.focus();
		const sel = window.getSelection();
		if (sel && ref.current.firstChild) {
			const range = document.createRange();
			range.setStart(ref.current, 0);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleInput = () => {
		if (ref.current) {
			updateEmptyState();
			onChange(ref.current.innerHTML);
		}
	};

	// Paste as plain text by default to avoid injecting unsanitized markup;
	// forwarded content is seeded separately and already sanitized.
	const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
		e.preventDefault();
		const text = e.clipboardData.getData("text/plain");
		document.execCommand("insertText", false, text);
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: a rich HTML editor must be a contentEditable div, not <input>/<textarea>, which cannot hold rendered HTML (formatting, tables, inline images).
		<div
			ref={ref}
			role="textbox"
			tabIndex={0}
			aria-multiline="true"
			aria-label={placeholder ?? "Message body"}
			contentEditable
			suppressContentEditableWarning
			onInput={handleInput}
			onPaste={handlePaste}
			data-placeholder={placeholder}
			className={cn(
				"email-html-editor flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none",
				"prose-email max-w-none",
				className,
			)}
		/>
	);
}
