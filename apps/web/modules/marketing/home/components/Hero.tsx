import { ArrowRightIcon } from "lucide-react";
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
							Think MailMonkey.
						</span>
					</h1>
					<p className="mx-auto mt-6 max-w-[36rem] text-[18px] leading-[1.6] text-black/80">
						Brand deals, investor replies, client requests. Nothing
						waits in your inbox. MailMonkey finds it, sorts it, and
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
			</div>
		</section>
	);
}
