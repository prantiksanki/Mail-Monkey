"use client";

import dynamic from "next/dynamic";

const GLSLHills = dynamic(
	() => import("./glsl-hills").then((m) => ({ default: m.GLSLHills })),
	{ ssr: false },
);

export function HeroBackground() {
	return (
		<div className="pointer-events-none absolute inset-0 z-[1]">
			<GLSLHills />
		</div>
	);
}
