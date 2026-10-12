"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

// First entry renders on the server, so keep "Email" at index 0.
// Add or reorder freely — the rotation just cycles this list.
const WORDS = [
	"Email",
	"Auto-draft",
	"Triage",
	"Inbox Zero",
	"Replies, done",
	"Zero backlog",
	"Nothing missed",
	"Follow-ups",
];

const INTERVAL_MS = 2200;

export function ThinkRotator() {
	const shouldReduceMotion = useReducedMotion();
	const [index, setIndex] = useState(0);

	useEffect(() => {
		const id = setInterval(() => {
			setIndex((current) => (current + 1) % WORDS.length);
		}, INTERVAL_MS);
		return () => clearInterval(id);
	}, []);

	const word = WORDS[index];

	return (
		<span className="block font-[family-name:var(--font-bricolage)] text-[clamp(40px,8vw,56px)] font-extrabold tracking-[-0.02em] lg:text-[72px]">
			Think{" "}
			<span className="relative inline-flex overflow-hidden pr-[0.08em] align-bottom">
				<AnimatePresence mode="popLayout" initial={false}>
					<motion.span
						key={word}
						className="inline-block whitespace-nowrap"
						initial={
							shouldReduceMotion
								? { opacity: 0 }
								: {
										opacity: 0,
										y: "0.6em",
										filter: "blur(6px)",
									}
						}
						animate={
							shouldReduceMotion
								? { opacity: 1 }
								: { opacity: 1, y: 0, filter: "blur(0px)" }
						}
						exit={
							shouldReduceMotion
								? { opacity: 0 }
								: {
										opacity: 0,
										y: "-0.6em",
										filter: "blur(6px)",
									}
						}
						transition={{
							duration: 0.45,
							ease: [0.22, 1, 0.36, 1],
						}}
					>
						{word}.
					</motion.span>
				</AnimatePresence>
			</span>
		</span>
	);
}
