"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import NextLink from "next/link";

const GLSLHills = dynamic(
	() => import("./glsl-hills").then((m) => ({ default: m.GLSLHills })),
	{ ssr: false },
);

export function Hero() {
	return (
		<section className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-black pt-20 font-[family-name:var(--font-bricolage),sans-serif]">
			{/* Three.js animated hills background */}
			<div className="pointer-events-none absolute inset-0 z-[1]">
				<GLSLHills />
			</div>

			{/* Centered heading */}
			<div className="relative z-[2] px-6 text-center">
				<h1 className="leading-[1.1] text-white">
					<span className="block font-[family-name:var(--font-instrument)] text-[clamp(2rem,5.5vw,5rem)] font-normal italic text-white/80">
						Meet your
					</span>
					<span className="block font-[family-name:var(--font-bricolage)] text-[clamp(2.6rem,7vw,6.5rem)] font-semibold tracking-[-0.02em]">
						AI chief of staff
					</span>
					<span className="block font-[family-name:var(--font-bricolage)] text-[clamp(2.6rem,7vw,6.5rem)] font-semibold tracking-[-0.02em]">
						for email.
					</span>
				</h1>
				<p className="mx-auto mt-6 max-w-[520px] text-[18px] leading-relaxed text-white/80">
					We craft intelligent routing and AI-powered automation that
					help your inbox stay clean and connect you with what
					actually matters.
				</p>
				<div className="mt-8 flex flex-wrap justify-center gap-3">
					<NextLink
						href="/auth/signup"
						prefetch
						className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
					>
						<Image
							src="/images/gmail-logo.png"
							alt="Gmail"
							width={16}
							height={16}
							priority
							className="shrink-0 object-contain"
						/>
						Connect Gmail
					</NextLink>
					<NextLink
						href="/auth/signup"
						prefetch
						className="inline-flex items-center gap-2.5 rounded-full bg-white px-6 py-3 text-[15px] font-semibold text-black transition-opacity hover:opacity-90"
					>
						<Image
							src="/images/outlook-logo.png"
							alt="Outlook"
							width={16}
							height={16}
							priority
							className="shrink-0 object-contain"
						/>
						Connect Outlook
					</NextLink>
				</div>

				{/* Backed by strip */}
				<div className="mt-10 flex flex-col items-center gap-4">
					{/* Pill label */}
					<div className="rounded-full border border-white/12 bg-white/8 px-5 py-2 backdrop-blur-sm">
						<span className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
							Backed by
						</span>
					</div>

					{/* Logos below */}
					<div className="flex items-center gap-5">
						{/* Google for Startups */}
						<div className="flex items-center gap-2">
							<svg
								width="15"
								height="15"
								viewBox="0 0 48 48"
								role="img"
								aria-label="Google"
								className="shrink-0 opacity-85"
							>
								<path
									d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.332 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
									fill="#FFC107"
								/>
								<path
									d="M6.306 14.691l6.571 4.819C14.655 15.108 19.001 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
									fill="#FF3D00"
								/>
								<path
									d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.312 0-9.623-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
									fill="#4CAF50"
								/>
								<path
									d="M43.611 20.083H42V20H24v8h11.303a11.987 11.987 0 01-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
									fill="#1976D2"
								/>
							</svg>
							<span className="text-[12px] font-semibold text-white/70">
								Google for Startups
							</span>
						</div>

						<span className="h-3.5 w-px bg-white/20" />

						{/* NVIDIA Inception */}
						<div className="flex items-center gap-2">
							<div className="rounded bg-white/90 px-1.5 py-0.5">
								<Image
									src="/images/nvidia-logo.jpg"
									alt="NVIDIA"
									width={44}
									height={16}
									className="shrink-0 object-contain"
								/>
							</div>
							<span className="text-[12px] font-semibold text-white/70">
								Inception Program
							</span>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
