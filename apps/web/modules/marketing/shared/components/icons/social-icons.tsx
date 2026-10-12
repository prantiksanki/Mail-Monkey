import type { SVGProps } from "react";

// Animated, currentColor-based social icons (draw-in on mount) — swapped in
// for lucide-react's Twitter/Instagram/Youtube in FollowUsDock so the "X"
// mark replaces the deprecated bird logo.

export function TwitterXAltIcon({
	size = 24,
	...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			aria-hidden="true"
			{...props}
		>
			<path
				fill="currentColor"
				d="M1 2h2.5l15 20h-2.5ZM5.5 2h2.5l15 20h-2.5ZM3 2h5v2h-5ZM16 20h5v2h-5ZM18.5 2h3.5l-17 20h-3.5Z"
			>
				<animate
					fill="freeze"
					attributeName="d"
					dur="0.8s"
					keyTimes="0;0.3;0.5;1"
					values="M8.5 2h2.5l0 0h-2.5ZM13 2h2.5l0 0h-2.5ZM10.5 2h5v0h-5ZM8.5 2h5v0h-5ZM10 2h3.5l0 0h-3.5Z;M8.5 2h2.5l0 20h-2.5ZM13 2h2.5l0 20h-2.5ZM10.5 2h5v2h-5ZM8.5 20h5v2h-5ZM10 2h3.5l0 20h-3.5Z;M8.5 2h2.5l0 20h-2.5ZM13 2h2.5l0 20h-2.5ZM10.5 2h5v2h-5ZM8.5 20h5v2h-5ZM10 2h3.5l0 20h-3.5Z;M1 2h2.5l15 20h-2.5ZM5.5 2h2.5l15 20h-2.5ZM3 2h5v2h-5ZM16 20h5v2h-5ZM18.5 2h3.5l-17 20h-3.5Z"
				/>
			</path>
		</svg>
	);
}

export function InstagramIcon({
	size = 24,
	...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			aria-hidden="true"
			{...props}
		>
			<g
				fill="none"
				stroke="currentColor"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
			>
				<path d="M3 12c0-4.243 0-6.364 1.318-7.682S7.758 3 12 3s6.364 0 7.682 1.318S21 7.758 21 12s0 6.364-1.318 7.682S16.242 21 12 21s-6.364 0-7.682-1.318S3 16.242 3 12" />
				<path d="M16 12a4 4 0 1 1-8 0a4 4 0 0 1 8 0m1.375-5.25h-.125m.25 0a.25.25 0 1 1-.5 0a.25.25 0 0 1 .5 0" />
			</g>
		</svg>
	);
}

export function YoutubeIcon({
	size = 24,
	...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
	return (
		<svg
			width={size}
			height={size}
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			aria-hidden="true"
			{...props}
		>
			<path
				fill="none"
				stroke="currentColor"
				strokeDasharray="60"
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth="2"
				d="M12 5c9 0 9 0 9 7c0 7 0 7 -9 7c-9 0 -9 0 -9 -7c0 -7 0 -7 9 -7Z"
			>
				<animate
					fill="freeze"
					attributeName="stroke-dashoffset"
					dur="0.6s"
					values="60;0"
				/>
			</path>
			<path fill="currentColor" d="M10 8.5l6 3.5l-6 3.5Z" opacity="0">
				<set
					fill="freeze"
					attributeName="opacity"
					begin="0.6s"
					to="1"
				/>
				<animate
					fill="freeze"
					attributeName="d"
					begin="0.6s"
					dur="0.2s"
					values="M12 11l0 1l0 1Z;M10 8.5l6 3.5l-6 3.5Z"
				/>
			</path>
		</svg>
	);
}
