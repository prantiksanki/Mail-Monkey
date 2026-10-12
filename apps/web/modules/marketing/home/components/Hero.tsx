import { ArrowRightIcon } from "lucide-react";
import Image from "next/image";
import NextLink from "next/link";
import { AnimatedGroup } from "./AnimatedGroup";
import { HeroBackground } from "./HeroBackground";
import { ThinkRotator } from "./ThinkRotator";

export function Hero() {
	return (
		<section className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-white pt-20 font-[family-name:var(--font-bricolage),sans-serif]">
			{/* Three.js animated hills background (client-only, doesn't block hero text paint) */}
			<HeroBackground />

			{/* Centered heading */}
			<div className="relative z-[2] px-6 text-center">
				<AnimatedGroup staggerChildren={0.15} delayChildren={0}>
					<h1 className="mx-auto max-w-[48rem] text-black leading-[1.05]">
						<ThinkRotator />
						<span className="block font-[family-name:var(--font-bricolage)] text-[clamp(40px,8vw,56px)] font-extrabold tracking-[-0.02em] lg:text-[72px]">
							Think Popsuites.
						</span>
					</h1>
					<p className="mx-auto mt-6 max-w-[36rem] text-[18px] leading-[1.6] text-black/80">
						Brand deals, investor replies, client requests. Nothing
						waits in your inbox. Popsuites finds it, sorts it, and
						acts on it.
					</p>
					<div className="mt-8 flex justify-center">
						<NextLink
							href="/auth/signup"
							prefetch
							className="group inline-flex items-center gap-4 rounded-full bg-black py-2 pr-2 pl-8 text-[17px] font-semibold leading-none text-white shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] transition-all duration-300 hover:bg-neutral-800"
						>
							Try now
							<span className="flex size-11 items-center justify-center rounded-full bg-white text-black transition-transform duration-300 group-hover:translate-x-1">
								<ArrowRightIcon className="size-5" />
							</span>
						</NextLink>
					</div>
				</AnimatedGroup>

				{/* Backing logos */}
				<div className="mt-10 flex flex-col items-center gap-4">
					<AnimatedGroup
						className="contents"
						staggerChildren={0.1}
						delayChildren={0.45}
					>
						{/* Announcement badge */}
						<div className="mx-auto inline-flex items-center gap-3 rounded-full border border-black/12 bg-black/5 py-1.5 pl-5 pr-1.5 backdrop-blur-sm">
							<span className="text-[14px] font-medium leading-[1.4] text-black/70">
								Backed by Google for Startups &amp; NVIDIA
								Inception
							</span>
							<span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-black/10 text-black/70">
								<ArrowRightIcon className="size-3.5" />
							</span>
						</div>

						<div className="flex items-center gap-5">
							{/* Google for Startups */}
							<div className="flex items-center gap-2">
								<svg
									width="25"
									height="25"
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
								<span className="text-[12px] font-semibold text-black/70">
									Google for Startups
								</span>
							</div>

							<span className="h-3.5 w-px bg-black/20" />

							{/* NVIDIA Inception */}
							<div className="flex items-center gap-2">
								<Image
									src="/images/Nvidia_logo.svg"
									alt="NVIDIA"
									width={34}
									height={25}
									className="shrink-0 object-contain"
								/>
								<span className="text-[12px] font-semibold text-black/70">
									Inception Program
								</span>
							</div>
						</div>
					</AnimatedGroup>
				</div>
			</div>
		</section>
	);
}
